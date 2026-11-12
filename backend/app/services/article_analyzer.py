from __future__ import annotations

import logging
import re
from collections.abc import Awaitable, Callable
from urllib.parse import urlsplit

from bs4 import BeautifulSoup

from app.core.config import Settings
from app.core.errors import AppError, BlockedTarget, FetchError
from app.schemas.analysis import AccessAssessment, AnalysisResult, ImageReference, NewspaperPage
from app.schemas.enums import AccessStatus, Confidence, PageType
from app.services.access_assessor import AccessAssessor, page_has_password_form
from app.services.article_extractor import ArticleExtraction, ArticleExtractor
from app.services.browser_renderer import BrowserRenderer
from app.services.metadata_extractor import MetadataExtractor, PageMetadata
from app.services.newspaper_extractor import (
    NewspaperExtraction,
    NewspaperExtractor,
    NewspaperSourceResolver,
)
from app.services.page_classifier import PageClassifier
from app.services.robots_policy import RobotsPolicy
from app.services.safe_fetcher import FetchResult, SafeFetcher
from app.services.url_signer import URLSigner
from app.services.url_validator import URLValidator
from app.utils.files import sniff_content_kind
from app.utils.text import normalize_inline

logger = logging.getLogger(__name__)

AsyncStageCallback = Callable[[str, float | None], Awaitable[None]]


class ArticleAnalyzer:
    def __init__(
        self,
        *,
        settings: Settings,
        validator: URLValidator,
        fetcher: SafeFetcher,
        robots: RobotsPolicy,
        metadata_extractor: MetadataExtractor,
        classifier: PageClassifier,
        article_extractor: ArticleExtractor,
        assessor: AccessAssessor,
        signer: URLSigner,
        renderer: BrowserRenderer,
    ) -> None:
        self.settings = settings
        self.validator = validator
        self.fetcher = fetcher
        self.robots = robots
        self.metadata_extractor = metadata_extractor
        self.classifier = classifier
        self.article_extractor = article_extractor
        self.assessor = assessor
        self.signer = signer
        self.renderer = renderer
        self.newspaper_extractor = NewspaperExtractor(max_pages=settings.max_newspaper_pages)
        self.newspaper_sources = NewspaperSourceResolver(fetcher, max_pages=settings.max_newspaper_pages)

    async def analyze(
        self,
        url: str,
        *,
        prefer_browser: bool = False,
        on_stage: AsyncStageCallback | None = None,
    ) -> AnalysisResult:
        async def stage(message: str, progress: float | None = None) -> None:
            if on_stage:
                await on_stage(message, progress)

        await stage("Validating the destination", 0.05)
        try:
            validated = await self.validator.validate(url)
        except BlockedTarget as exc:
            return self._policy_result(url, exc.message)
        except AppError as exc:
            return self._failed_result(url, exc.message, code=exc.code)

        await stage("Checking the publisher's access policy", 0.1)
        try:
            robots_decision = await self.robots.allowed(validated)
        except Exception as exc:  # pragma: no cover - defensive
            logger.info("robots check failed: %s", exc)
            robots_decision = None
        if robots_decision is not None and not robots_decision.allowed:
            return self._policy_result(url, robots_decision.reason)

        await stage("Fetching the publicly available page", 0.2)
        try:
            response = await self.fetcher.fetch(validated.url)
        except FetchError as exc:
            return self._failed_result(url, exc.message, code=exc.code)
        except BlockedTarget as exc:
            return self._policy_result(url, exc.message)
        except AppError as exc:
            return self._failed_result(url, exc.message, code=exc.code)

        content_type = response.content_type
        detected_kind = sniff_content_kind(response.content[:4096])
        if detected_kind == "PDF_DOCUMENT" or content_type == "application/pdf":
            return self._document_result(
                url,
                PageType.PDF_DOCUMENT,
                title=self._title_from_url(url),
                explanation=(
                    "This URL points to a PDF document. Download it from the publisher and upload it in the "
                    "Documents workspace to read it with the newspaper viewer or OCR."
                ),
                content_type="application/pdf",
            )
        if detected_kind == "IMAGE_DOCUMENT" or content_type.startswith("image/"):
            return self._document_result(
                url,
                PageType.IMAGE_DOCUMENT,
                title=self._title_from_url(url),
                explanation=(
                    "This URL points to an image. Save the image from the publisher and upload it in the "
                    "Documents workspace to run text extraction with OCR."
                ),
                content_type=content_type,
            )
        if content_type and not content_type.startswith(("text/html", "application/xhtml")):
            return self._document_result(
                url,
                PageType.UNSUPPORTED,
                title=self._title_from_url(url),
                explanation=(
                    f"The publisher returned {content_type}, which Ghost Reader does not read as an article."
                ),
                content_type=content_type,
            )

        html = self._decode_html(response)
        if not html.strip():
            return self._failed_result(
                url,
                "The publisher returned an empty response body.",
                code="EMPTY_RESPONSE",
            )

        await stage("Extracting metadata and article structure", 0.45)
        metadata = self.metadata_extractor.extract(
            html, base_url=response.final_url or validated.url, content_type=content_type
        )
        soup = BeautifulSoup(html, "lxml")
        classification = self.classifier.classify(
            url=response.final_url or validated.url,
            content_type=content_type,
            metadata=metadata,
            soup=soup,
        )
        newspaper = NewspaperExtraction()
        if classification.page_type == PageType.NEWSPAPER_VIEWER:
            newspaper = self.newspaper_extractor.extract(html, base_url=response.final_url or validated.url)
            if not newspaper.pages:
                await stage("Resolving the publisher's public page index", 0.5)
                try:
                    resolved = await self.newspaper_sources.resolve(response.final_url or validated.url)
                except Exception:  # pragma: no cover - defensive
                    logger.exception("public newspaper source resolution failed")
                    resolved = None
                if resolved is not None:
                    newspaper = resolved
        extraction = self.article_extractor.extract(
            html, base_url=response.final_url or validated.url, title=metadata.title
        )
        assessment = self.assessor.assess(
            status_code=response.status_code,
            html=html,
            metadata=metadata,
            extraction=extraction,
            content_type=content_type,
            has_password_form=page_has_password_form(html),
        )

        fetched_via = "http"
        notes: list[str] = list(extraction.notes)

        if assessment.status == AccessStatus.JS_REQUIRED and not (newspaper.source and newspaper.pages):
            if not self.settings.enable_browser_fallback:
                notes.append(
                    "JavaScript rendering is disabled in this deployment. Only the publicly delivered HTML was assessed."
                )
            else:
                await stage("Rendering public content with an isolated browser", 0.6)
                rendered = await self.renderer.render(response.final_url or validated.url)
                if rendered is not None and rendered.html:
                    rendered_metadata = self.metadata_extractor.extract(
                        rendered.html,
                        base_url=rendered.final_url,
                        content_type="text/html",
                    )
                    rendered_extraction = self.article_extractor.extract(
                        rendered.html,
                        base_url=rendered.final_url,
                        title=rendered_metadata.title,
                    )
                    rendered_assessment = self.assessor.assess(
                        status_code=rendered.status_code or response.status_code,
                        html=rendered.html,
                        metadata=rendered_metadata,
                        extraction=rendered_extraction,
                        content_type="text/html",
                        has_password_form=page_has_password_form(rendered.html),
                    )
                    if rendered_extraction.word_count > extraction.word_count:
                        metadata = rendered_metadata
                        extraction = rendered_extraction
                        assessment = rendered_assessment
                        soup = BeautifulSoup(rendered.html, "lxml")
                        content_type = "text/html"
                        fetched_via = "browser"
                        newspaper = self.newspaper_extractor.extract(
                            rendered.html, base_url=rendered.final_url
                        )
                        notes.append("An isolated JavaScript browser was used for public content rendering.")
                    else:
                        notes.append(
                            "The JavaScript browser did not reveal additional public article content."
                        )
                else:
                    notes.append(
                        "JavaScript rendering was enabled but the isolated browser could not be used for this page."
                    )

        if prefer_browser and fetched_via == "http":
            notes.append(
                "Browser rendering was requested, but it is only used when HTML extraction is insufficient "
                "and the browser fallback is enabled."
            )

        await stage("Finalising the access assessment", 0.9)
        images, blocks = self._sign_images(extraction, metadata)
        content_statuses = {
            AccessStatus.PUBLIC_FULL,
            AccessStatus.PUBLIC_PARTIAL,
            AccessStatus.SUBSCRIPTION_REQUIRED,
            AccessStatus.LOGIN_REQUIRED,
        }
        include_content = assessment.status in content_statuses
        known_public_pages = newspaper.source is not None and assessment.status in {
            AccessStatus.UNSUPPORTED,
            AccessStatus.JS_REQUIRED,
        }
        include_newspaper = bool(newspaper.pages) and (include_content or known_public_pages)
        newspaper_pages: list[NewspaperPage] = []
        if newspaper.pages and include_newspaper:
            newspaper_pages = self._sign_newspaper_pages(newspaper.pages)
            confidence = (
                Confidence.HIGH
                if newspaper.reported_page_count in {None, len(newspaper_pages)}
                else Confidence.MEDIUM
            )
            evidence = [
                f"Found {len(newspaper_pages)} public page image URLs in the publisher's viewer.",
                "Page images are delivered through Ghost Reader's signed image proxy.",
            ]
            if newspaper.reported_page_count is not None:
                evidence.append(
                    f"The viewer reported {newspaper.reported_page_count} pages for this edition."
                )
            assessment = AccessAssessment(
                status=AccessStatus.PUBLIC_FULL,
                confidence=confidence,
                explanation=(
                    f"The publisher's public viewer exposes {len(newspaper_pages)} newspaper pages "
                    "for this edition. Ghost Reader presents those publicly delivered pages without "
                    "bypassing any login or paywall."
                ),
                evidence=evidence,
            )
        elif newspaper.pages:
            notes.append(
                "Newspaper pages were discovered, but they were withheld because the access "
                "assessment did not confirm public content."
            )
        notes.extend(newspaper.notes)
        if assessment.status not in content_statuses:
            blocks = []
            images = []
            newspaper_pages = []

        language = metadata.language
        if language is None or newspaper_pages:
            detected_language = self._detect_language(f"{extraction.text}\n{metadata.description or ''}")
            if detected_language:
                language = detected_language
        if metadata.canonical_url:
            try:
                parsed = urlsplit(metadata.canonical_url)
                if parsed.scheme not in {"http", "https"}:
                    metadata.canonical_url = None
            except ValueError:
                metadata.canonical_url = None

        publisher = metadata.publisher or (urlsplit(validated.url).hostname or "").lower() or None
        title = metadata.title
        published_at = metadata.published_at
        if newspaper_pages:
            publication = None
            if newspaper.publication:
                publication = self._tidy_publication(newspaper.publication)
                if not publisher or "." in publisher:
                    publisher = publication
            title = self._tidy_newspaper_title(title)
            if not title or title.strip().isdigit():
                title = publication or publisher
            published_at = published_at or newspaper.edition_date
        source_metadata = metadata.as_source_metadata()
        source_metadata.update(
            {
                "http_status": response.status_code,
                "final_url": response.final_url,
                "redirect_count": len(response.redirects),
                "fetch_elapsed_ms": response.elapsed_ms,
                "content_type": content_type,
                "outbound_links": extraction.links[:12],
            }
        )
        if robots_decision:
            source_metadata["robots_decision"] = robots_decision.reason
        if classification.evidence:
            source_metadata["page_classification_evidence"] = classification.evidence
        if newspaper_pages:
            source_metadata["newspaper_page_count"] = len(newspaper_pages)
            if newspaper.publication:
                source_metadata["newspaper_publication"] = newspaper.publication
            if newspaper.source:
                source_metadata["newspaper_source"] = newspaper.source
            if newspaper.reported_page_count is not None:
                source_metadata["newspaper_reported_page_count"] = newspaper.reported_page_count
            if newspaper.edition_date:
                source_metadata["newspaper_edition_date"] = newspaper.edition_date

        subtitle = None
        if metadata.description and metadata.title and metadata.description != metadata.title:
            subtitle = metadata.description

        return AnalysisResult(
            source_url=url,
            canonical_url=metadata.canonical_url,
            publisher=publisher,
            title=title or self._title_from_url(url),
            subtitle=subtitle,
            author=metadata.author,
            published_at=published_at,
            updated_at=metadata.updated_at,
            description=metadata.description,
            language=language,
            content_type=classification.page_type,
            access_status=assessment.status,
            content=blocks if include_content else [],
            images=images if include_content else [],
            newspaper_pages=newspaper_pages,
            source_metadata=source_metadata,
            access_assessment=assessment,
            word_count=extraction.word_count if include_content and not newspaper_pages else 0,
            reading_time_minutes=(
                extraction.reading_time_minutes if include_content and not newspaper_pages else 0
            ),
            fetched_via=fetched_via if include_content else "none",
            extractor=(
                "newspaper-viewer" if newspaper_pages else extraction.extractor if include_content else None
            ),
            notes=notes,
        )

    def _sign_newspaper_pages(self, pages: list[NewspaperPage]) -> list[NewspaperPage]:
        signed: list[NewspaperPage] = []
        for page in pages:
            signed.append(page.model_copy(update={"proxy_url": self.signer.sign_path(page.image_url)}))
        return signed

    def _sign_images(
        self,
        extraction: ArticleExtraction,
        metadata: PageMetadata,
    ) -> tuple[list[ImageReference], list]:
        images: list[ImageReference] = []
        seen: set[str] = set()
        if metadata.featured_image:
            images.append(
                ImageReference(
                    url=metadata.featured_image,
                    proxy_url=self.signer.sign_path(metadata.featured_image),
                    alt=metadata.title,
                )
            )
            seen.add(metadata.featured_image)
        for image in extraction.images:
            if image.url in seen:
                continue
            image.proxy_url = self.signer.sign_path(image.url)
            images.append(image)
            seen.add(image.url)
            if len(images) >= self.settings.max_article_images:
                break
        proxy_by_url = {image.url: image.proxy_url for image in images}
        for block in extraction.blocks:
            if block.image_url and block.image_url in proxy_by_url:
                block.proxy_url = proxy_by_url[block.image_url]
            elif block.image_url:
                block.proxy_url = self.signer.sign_path(block.image_url)
        return images, extraction.blocks

    @staticmethod
    def _decode_html(response: FetchResult) -> str:
        encodings = []
        if response.charset:
            encodings.append(response.charset)
        encodings.extend(["utf-8", "windows-1252"])
        for encoding in encodings:
            try:
                return response.content.decode(encoding)
            except (LookupError, UnicodeDecodeError):
                continue
        return response.content.decode("utf-8", errors="replace")

    @staticmethod
    def _detect_language(text: str) -> str | None:
        if not text:
            return None
        sample = text[:4000]
        kannada = sum(1 for char in sample if "\u0c80" <= char <= "\u0cff")
        if kannada and kannada / max(len(sample), 1) > 0.2:
            return "kn"
        return None

    @staticmethod
    def _tidy_publication(publication: str) -> str:
        cleaned = normalize_inline(publication)
        return cleaned.title() if cleaned.isupper() else cleaned

    @staticmethod
    def _tidy_newspaper_title(title: str | None) -> str | None:
        if not title:
            return title
        parts = [normalize_inline(part) for part in re.split(r"\s+[-–—|]\s+", title) if part.strip()]
        if len(parts) == 2 and parts[0].casefold() == parts[1].casefold():
            return parts[0]
        return normalize_inline(title) or None

    @staticmethod
    def _title_from_url(url: str) -> str:
        path = urlsplit(url).path.rstrip("/")
        if path:
            name = path.rsplit("/", 1)[-1]
            name = name.rsplit(".", 1)[0].replace("-", " ").replace("_", " ")
            cleaned = normalize_inline(name)
            if cleaned:
                return cleaned[:120]
        host = urlsplit(url).hostname or ""
        return host or "Untitled page"

    def _base_result(
        self,
        url: str,
        *,
        page_type: PageType,
        title: str | None,
        assessment: AccessAssessment,
    ) -> AnalysisResult:
        return AnalysisResult(
            source_url=url,
            canonical_url=None,
            publisher=(urlsplit(url).hostname or "").lower() or None,
            title=title or self._title_from_url(url),
            content_type=page_type,
            access_status=assessment.status,
            content=[],
            images=[],
            source_metadata={},
            access_assessment=assessment,
        )

    def _policy_result(self, url: str, explanation: str) -> AnalysisResult:
        assessment = AccessAssessment(
            status=AccessStatus.BLOCKED_BY_POLICY,
            confidence=Confidence.HIGH,
            explanation=explanation,
            evidence=["Blocked before any request was made to the destination."],
        )
        return self._base_result(
            url, page_type=PageType.GENERAL_WEBPAGE, title=self._title_from_url(url), assessment=assessment
        )

    def _failed_result(self, url: str, explanation: str, *, code: str) -> AnalysisResult:
        assessment = AccessAssessment(
            status=AccessStatus.FETCH_FAILED,
            confidence=Confidence.MEDIUM,
            explanation=explanation,
            evidence=[f"Technical error code: {code}"],
        )
        return self._base_result(
            url, page_type=PageType.GENERAL_WEBPAGE, title=self._title_from_url(url), assessment=assessment
        )

    def _document_result(
        self,
        url: str,
        page_type: PageType,
        *,
        title: str,
        explanation: str,
        content_type: str,
    ) -> AnalysisResult:
        assessment = AccessAssessment(
            status=AccessStatus.UNSUPPORTED,
            confidence=Confidence.HIGH,
            explanation=explanation,
            evidence=[f"Detected content type: {content_type or page_type.value}"],
        )
        return self._base_result(url, page_type=page_type, title=title, assessment=assessment)
