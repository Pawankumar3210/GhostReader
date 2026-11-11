from __future__ import annotations

import re
from dataclasses import dataclass, field
from urllib.parse import urlsplit

from bs4 import BeautifulSoup

from app.schemas.enums import PageType
from app.services.metadata_extractor import PageMetadata


@dataclass
class PageClassification:
    page_type: PageType
    confidence: str
    evidence: list[str] = field(default_factory=list)


_NEWS_TYPES = {
    "newsarticle",
    "reportagenewsarticle",
    "analysisnewsarticle",
    "opinionnewsarticle",
    "reviewnewsarticle",
    "backgroundnewsarticle",
}
_BLOG_TYPES = {"blogposting", "liveblogposting"}
_ARTICLE_TYPES = {"article", "techarticle", "scholarlyarticle"}
_DIGITAL_VIEWER_HOSTS = (
    "issuu.com",
    "calameo.com",
    "flipbook",
    "fliphtml5",
    "anyflip",
    "yumpu",
    "pressreader",
)
_VIEWER_MARKERS = (
    "epaper",
    "e-paper",
    "digital-edition",
    "digitaledition",
    "flipbook",
    "pageflip",
    "flip-viewer",
    "turn.js",
)
_NEWS_PATH_RE = re.compile(
    r"/(news|article|articles|story|stories|world|politics|business|sports|opinion|editorial|"
    r"entertainment|technology|science|health|lifestyle|local|national|international)(/|$)",
    re.IGNORECASE,
)


class PageClassifier:
    def classify(
        self,
        *,
        url: str,
        content_type: str,
        metadata: PageMetadata | None = None,
        soup: BeautifulSoup | None = None,
    ) -> PageClassification:
        content_type = (content_type or "").lower()
        if content_type == "application/pdf" or url.lower().split("?")[0].endswith(".pdf"):
            return PageClassification(PageType.PDF_DOCUMENT, "high", ["PDF content detected"])
        if content_type.startswith("image/"):
            return PageClassification(PageType.IMAGE_DOCUMENT, "high", ["Image content detected"])

        host = (urlsplit(url).hostname or "").lower()
        if any(viewer in host for viewer in _DIGITAL_VIEWER_HOSTS):
            return PageClassification(
                PageType.NEWSPAPER_VIEWER, "medium", [f"Known digital publication host: {host}"]
            )

        json_ld = [item.lower() for item in (metadata.json_ld_types if metadata else [])]
        og_type = (metadata.og_type if metadata else "") or ""
        combined = " ".join([url, host])

        if any(item in _NEWS_TYPES for item in json_ld):
            return PageClassification(PageType.NEWS_ARTICLE, "high", ["JSON-LD identifies a news article"])
        if any(item in _BLOG_TYPES for item in json_ld):
            return PageClassification(PageType.BLOG_ARTICLE, "high", ["JSON-LD identifies a blog post"])
        if any(item in _ARTICLE_TYPES for item in json_ld):
            if _NEWS_PATH_RE.search(urlsplit(url).path) or any(
                token in host for token in ("news", "times", "herald", "daily", "post")
            ):
                return PageClassification(
                    PageType.NEWS_ARTICLE, "medium", ["JSON-LD Article on a news-like source"]
                )
            return PageClassification(PageType.BLOG_ARTICLE, "medium", ["JSON-LD identifies an article"])
        if og_type.lower() in {"article", "news.article"}:
            return PageClassification(
                PageType.NEWS_ARTICLE, "medium", ["Open Graph type identifies an article"]
            )

        if soup is not None:
            viewer_markers = []
            for marker in _VIEWER_MARKERS:
                if (
                    marker in combined
                    or soup.find(attrs={"id": re.compile(marker, re.I)})
                    or soup.find(attrs={"class": re.compile(marker, re.I)})
                ):
                    viewer_markers.append(marker)
            if viewer_markers:
                if any(
                    token in host for token in ("epaper", "news", "times", "herald")
                ) or "epaper" in " ".join(viewer_markers):
                    return PageClassification(
                        PageType.NEWSPAPER_VIEWER,
                        "medium",
                        [f"Digital newspaper viewer markers: {', '.join(sorted(set(viewer_markers))[:3])}"],
                    )
                return PageClassification(
                    PageType.PUBLICATION_LANDING,
                    "low",
                    [f"Publication viewer markers: {', '.join(sorted(set(viewer_markers))[:3])}"],
                )

        if _NEWS_PATH_RE.search(urlsplit(url).path):
            return PageClassification(PageType.NEWS_ARTICLE, "low", ["News-like URL path pattern"])
        if metadata and metadata.title and metadata.description:
            return PageClassification(PageType.GENERAL_WEBPAGE, "low", ["Page has document-like metadata"])
        return PageClassification(PageType.GENERAL_WEBPAGE, "low", ["No article-specific signals"])
