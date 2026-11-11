from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

from app.utils.text import language_from_locale, normalize_inline, truncate

logger = logging.getLogger(__name__)

_ARTICLE_TYPES = {
    "article",
    "newsarticle",
    "blogposting",
    "report",
    "analysisnewsarticle",
    "opinionnewsarticle",
    "techarticle",
    "scholarlyarticle",
    "webpage",
}


@dataclass
class PageMetadata:
    title: str | None = None
    description: str | None = None
    publisher: str | None = None
    author: str | None = None
    published_at: str | None = None
    updated_at: str | None = None
    canonical_url: str | None = None
    featured_image: str | None = None
    language: str | None = None
    site_name: str | None = None
    og_type: str | None = None
    json_ld_types: list[str] = field(default_factory=list)
    is_accessible_for_free: bool | None = None
    content_tier: str | None = None
    has_article_body_ld: bool = False
    article_body_ld_length: int = 0
    raw: dict[str, Any] = field(default_factory=dict)

    def as_source_metadata(self) -> dict[str, Any]:
        data = {
            "title": self.title,
            "description": truncate(self.description, 500) if self.description else None,
            "publisher": self.publisher,
            "author": self.author,
            "published_at": self.published_at,
            "updated_at": self.updated_at,
            "canonical_url": self.canonical_url,
            "featured_image": self.featured_image,
            "language": self.language,
            "site_name": self.site_name,
            "og_type": self.og_type,
            "json_ld_types": self.json_ld_types[:12],
            "is_accessible_for_free": self.is_accessible_for_free,
            "content_tier": self.content_tier,
            "has_article_body_ld": self.has_article_body_ld,
        }
        return {key: value for key, value in data.items() if value not in (None, "", [], False)}


def _first(value: Any) -> Any:
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _string(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return normalize_inline(value) or None
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, dict):
        for key in ("name", "headline", "text", "url", "@value"):
            if key in value:
                return _string(value[key])
    if isinstance(value, list):
        parts = [_string(item) for item in value]
        parts = [part for part in parts if part]
        return ", ".join(parts) if parts else None
    return None


def _parse_boolean(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "yes", "1"}:
            return True
        if lowered in {"false", "no", "0"}:
            return False
    return None


def _normalize_date(value: Any) -> str | None:
    text = _string(value)
    if not text:
        return None
    cleaned = text.strip()
    for candidate in (cleaned, cleaned.replace("Z", "+00:00")):
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                return parsed.isoformat(timespec="seconds")
            return parsed.isoformat(timespec="seconds")
        except ValueError:
            continue
    for fmt in ("%d %B %Y", "%B %d, %Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(cleaned, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _iter_json_ld(soup: BeautifulSoup) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = script.string or script.get_text()
        if not raw or not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            item = stack.pop(0)
            if isinstance(item, dict):
                if "@graph" in item and isinstance(item["@graph"], list):
                    stack.extend(item["@graph"])
                nodes.append(item)
            elif isinstance(item, list):
                stack.extend(item)
    return nodes


def _json_ld_types(node: dict[str, Any]) -> list[str]:
    raw = node.get("@type")
    if isinstance(raw, str):
        return [raw]
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, str)]
    return []


def _safe_image_url(value: Any, base_url: str | None) -> str | None:
    url = _string(value)
    if not url:
        return None
    if isinstance(value, list):
        url = _string(_first(value))
    if not url:
        return None
    absolute = urljoin(base_url, url) if base_url else url
    try:
        parsed = urlsplit(absolute)
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    return absolute


class MetadataExtractor:
    def extract(
        self,
        html: str,
        *,
        base_url: str | None,
        content_type: str = "",
    ) -> PageMetadata:
        soup = BeautifulSoup(html, "lxml")
        metadata = PageMetadata()

        meta: dict[str, str] = {}
        for tag in soup.find_all("meta"):
            key = tag.get("property") or tag.get("name") or tag.get("itemprop")
            value = tag.get("content")
            if key and value:
                meta[key.strip().lower()] = value.strip()

        title_tag = soup.find("title")
        html_tag = soup.find("html")
        metadata.title = (
            normalize_inline(
                meta.get("og:title")
                or meta.get("twitter:title")
                or (title_tag.get_text(" ", strip=True) if title_tag else None)
            )
            or None
        )
        metadata.description = (
            normalize_inline(
                meta.get("og:description") or meta.get("twitter:description") or meta.get("description")
            )
            or None
        )
        metadata.site_name = normalize_inline(meta.get("og:site_name")) or None
        metadata.og_type = normalize_inline(meta.get("og:type")) or None
        metadata.publisher = metadata.site_name or normalize_inline(
            meta.get("application-name") or meta.get("publisher")
        )
        metadata.author = (
            normalize_inline(meta.get("author") or meta.get("article:author") or meta.get("twitter:creator"))
            or None
        )
        if metadata.author:
            metadata.author = metadata.author.removeprefix("By ").strip() or None
        if metadata.author and metadata.author.startswith(("http://", "https://")):
            metadata.author = None
        metadata.published_at = _normalize_date(
            meta.get("article:published_time")
            or meta.get("datepublished")
            or meta.get("date")
            or meta.get("pubdate")
            or meta.get("publish-date")
        )
        metadata.updated_at = _normalize_date(
            meta.get("article:modified_time") or meta.get("datemodified") or meta.get("last-modified")
        )
        metadata.content_tier = (
            normalize_inline(meta.get("article:content_tier") or meta.get("content_tier")) or None
        )

        canonical = soup.find("link", attrs={"rel": lambda value: value and "canonical" in value})
        if canonical and canonical.get("href"):
            metadata.canonical_url = urljoin(base_url or "", canonical["href"])

        metadata.featured_image = _safe_image_url(
            meta.get("og:image")
            or meta.get("og:image:url")
            or meta.get("twitter:image")
            or meta.get("twitter:image:src"),
            base_url,
        )

        metadata.language = language_from_locale(
            (html_tag.get("lang") if html_tag else None) or meta.get("og:locale") or meta.get("language")
        )

        time_tag = soup.find("time")
        if time_tag and not metadata.published_at:
            metadata.published_at = _normalize_date(time_tag.get("datetime"))

        json_ld_nodes = _iter_json_ld(soup)
        primary: dict[str, Any] | None = None
        for node in json_ld_nodes:
            types = [item.lower() for item in _json_ld_types(node)]
            if types:
                metadata.json_ld_types.extend(
                    item for item in _json_ld_types(node) if item not in metadata.json_ld_types
                )
            if primary is None and any(item in _ARTICLE_TYPES for item in types) and node.get("headline"):
                primary = node
            accessible_value = node.get("isAccessibleForFree")
            if accessible_value is not None:
                metadata.is_accessible_for_free = _parse_boolean(accessible_value)
            article_body = node.get("articleBody")
            if isinstance(article_body, str) and len(article_body.strip()) > 40:
                metadata.has_article_body_ld = True
                metadata.article_body_ld_length = max(
                    metadata.article_body_ld_length, len(article_body.strip())
                )

        if primary:
            metadata.title = (
                metadata.title or _string(primary.get("headline")) or _string(primary.get("name"))
            )
            metadata.description = metadata.description or _string(primary.get("description"))
            metadata.author = metadata.author or _string(primary.get("author"))
            metadata.publisher = metadata.publisher or _string(primary.get("publisher"))
            metadata.published_at = metadata.published_at or _normalize_date(primary.get("datePublished"))
            metadata.updated_at = metadata.updated_at or _normalize_date(primary.get("dateModified"))
            metadata.featured_image = metadata.featured_image or _safe_image_url(
                primary.get("image"), base_url
            )
            metadata.language = metadata.language or language_from_locale(_string(primary.get("inLanguage")))
            accessible_value = primary.get("isAccessibleForFree")
            if accessible_value is not None:
                metadata.is_accessible_for_free = _parse_boolean(accessible_value)
            body = primary.get("articleBody")
            if isinstance(body, str) and len(body.strip()) > 40:
                metadata.has_article_body_ld = True
                metadata.article_body_ld_length = max(metadata.article_body_ld_length, len(body.strip()))

        if metadata.publisher and metadata.publisher.lower() in {"home", "index"}:
            metadata.publisher = None
        if not metadata.title:
            h1 = soup.find("h1")
            metadata.title = normalize_inline(h1.get_text(" ", strip=True)) if h1 else None
        if metadata.title and metadata.site_name and metadata.title.endswith(f" - {metadata.site_name}"):
            metadata.title = metadata.title[: -(len(metadata.site_name) + 3)].strip() or None

        if metadata.description and metadata.title and metadata.description == metadata.title:
            metadata.description = None

        metadata.raw = {
            "og_type": metadata.og_type,
            "site_name": metadata.site_name,
            "content_type": content_type,
        }
        return metadata
