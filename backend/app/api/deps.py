from __future__ import annotations

import logging
from dataclasses import dataclass

from fastapi import Request

from app.core.config import Settings
from app.security_lab.scenarios import SecurityLab
from app.services.access_assessor import AccessAssessor
from app.services.article_analyzer import ArticleAnalyzer
from app.services.article_extractor import ArticleExtractor
from app.services.browser_renderer import BrowserRenderer
from app.services.document_processor import DocumentProcessor
from app.services.image_proxy import ImageProxy
from app.services.job_service import JobService, LocalJobRunner
from app.services.job_store import JobStore, create_job_store
from app.services.metadata_extractor import MetadataExtractor
from app.services.ocr_service import OcrService
from app.services.page_classifier import PageClassifier
from app.services.robots_policy import RobotsPolicy
from app.services.safe_fetcher import SafeFetcher
from app.services.url_signer import URLSigner
from app.services.url_validator import URLValidator

logger = logging.getLogger(__name__)


@dataclass
class Services:
    settings: Settings
    store: JobStore
    validator: URLValidator
    fetcher: SafeFetcher
    signer: URLSigner
    analyzer: ArticleAnalyzer
    documents: DocumentProcessor
    ocr: OcrService
    jobs: JobService
    image_proxy: ImageProxy
    lab: SecurityLab


async def build_services(settings: Settings) -> Services:
    storage = settings.storage_path
    storage.mkdir(parents=True, exist_ok=True, mode=0o700)

    validator = URLValidator(
        allowed_ports=settings.allowed_port_set,
        resolution_timeout=settings.connect_timeout_seconds,
    )
    fetcher = SafeFetcher(settings, validator)
    signer = URLSigner(settings)
    robots = RobotsPolicy(settings, fetcher)
    metadata_extractor = MetadataExtractor()
    classifier = PageClassifier()
    article_extractor = ArticleExtractor(max_images=settings.max_article_images)
    assessor = AccessAssessor()
    renderer = BrowserRenderer(settings, validator)

    analyzer = ArticleAnalyzer(
        settings=settings,
        validator=validator,
        fetcher=fetcher,
        robots=robots,
        metadata_extractor=metadata_extractor,
        classifier=classifier,
        article_extractor=article_extractor,
        assessor=assessor,
        signer=signer,
        renderer=renderer,
    )

    ocr = OcrService(settings)
    documents = DocumentProcessor(settings, ocr)
    store = await create_job_store(settings)
    runner = LocalJobRunner(settings.max_concurrent_jobs)
    jobs = JobService(
        settings=settings,
        store=store,
        analyzer=analyzer,
        documents=documents,
        validator=validator,
        runner=runner,
    )
    image_proxy = ImageProxy(settings, fetcher)
    lab = SecurityLab(settings, metadata_extractor, article_extractor, assessor)

    ocr_status = await _run_in_thread(ocr.status_summary)
    if not ocr_status.get("available"):
        logger.warning("OCR unavailable: %s", ocr_status.get("error"))
    elif not ocr_status.get("kannada_available"):
        logger.warning(
            "Tesseract is available but Kannada language data (kan) is missing; Kannada OCR will be reported as unavailable."
        )
    logger.info(
        "Ghost Reader services ready (store=%s, browser_fallback=%s)",
        store.backend_name,
        settings.enable_browser_fallback and renderer.package_available(),
    )

    return Services(
        settings=settings,
        store=store,
        validator=validator,
        fetcher=fetcher,
        signer=signer,
        analyzer=analyzer,
        documents=documents,
        ocr=ocr,
        jobs=jobs,
        image_proxy=image_proxy,
        lab=lab,
    )


async def _run_in_thread(func):  # type: ignore[no-untyped-def]
    import asyncio

    return await asyncio.to_thread(func)


def get_services(request: Request) -> Services:
    return request.app.state.services
