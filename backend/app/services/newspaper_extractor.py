from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from urllib.parse import parse_qs, urljoin, urlsplit

from bs4 import BeautifulSoup, Tag

from app.schemas.analysis import NewspaperPage
from app.utils.text import normalize_inline

_PAGE_NUMBER_RE = re.compile(
    r"\bpage\s*(?:no\.?|number|#)?\s*[-:#]?\s*(\d{1,3})\b",
    re.IGNORECASE,
)
_BLANK_IMAGE_HINTS = ("blankpage", "blank-page", "placeholder", "transparent.gif")
_PAGE_ATTRIBUTES = ("data-page-number", "data-page", "data-pagenumber")


@dataclass
class NewspaperExtraction:
    pages: list[NewspaperPage] = field(default_factory=list)
    reported_page_count: int | None = None
    publication: str | None = None
    edition_date: str | None = None
    notes: list[str] = field(default_factory=list)


def _absolute_url(raw: str | None, base_url: str) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    if not raw or raw.startswith("data:") or raw.lower().startswith("javascript:"):
        return None
    if any(hint in raw.lower() for hint in _BLANK_IMAGE_HINTS):
        return None
    absolute = urljoin(base_url, raw)
    try:
        parsed = urlsplit(absolute)
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    return absolute


def _page_number_from_tag(tag: Tag) -> int | None:
    for attribute in (*_PAGE_ATTRIBUTES, "alt", "title"):
        value = tag.get(attribute)
        if not value:
            continue
        match = _PAGE_NUMBER_RE.search(str(value))
        if match:
            number = int(match.group(1))
            if number > 0:
                return number
    return None


def _page_image_url(tag: Tag, base_url: str) -> tuple[str | None, bool]:
    for attribute in ("img_hires", "data-img-hires", "data-hires"):
        candidate = _absolute_url(tag.get(attribute), base_url)
        if candidate:
            return candidate, True
    for attribute in ("img_low", "data-img-low", "src", "data-src", "data-lazy-src", "data-original"):
        candidate = _absolute_url(tag.get(attribute), base_url)
        if candidate:
            return candidate, False
    return None, False


def _edition_date(base_url: str) -> str | None:
    query = parse_qs(urlsplit(base_url).query)
    for key in ("pgdate", "editiondate", "edition_date", "date"):
        value = query.get(key, [None])[0]
        if not value or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            continue
        try:
            parsed = date.fromisoformat(value)
        except ValueError:
            continue
        if 1900 <= parsed.year <= 2200:
            return f"{value}T12:00:00Z"
    return None


def _publication_from_label(label: str | None) -> str | None:
    if not label:
        return None
    match = re.split(r"\bpage\s*(?:no\.?|number|#)?\b", label, maxsplit=1, flags=re.IGNORECASE)
    if not match:
        return None
    candidate = normalize_inline(match[0].strip(" -:|"))
    return candidate or None


class NewspaperExtractor:
    """Discovers publicly delivered page images in digital newspaper viewers."""

    def __init__(self, max_pages: int = 64) -> None:
        self.max_pages = max_pages

    def extract(self, html: str, *, base_url: str) -> NewspaperExtraction:
        soup = BeautifulSoup(html, "lxml")
        extraction = NewspaperExtraction()
        extraction.reported_page_count = self._reported_page_count(soup)
        extraction.edition_date = _edition_date(base_url)

        candidates: dict[int, NewspaperPage] = {}
        high_resolution: dict[int, bool] = {}
        for tag in soup.find_all("img"):
            page_number = _page_number_from_tag(tag)
            if page_number is None:
                continue
            image_url, is_high_resolution = _page_image_url(tag, base_url)
            if not image_url:
                continue
            label = normalize_inline(tag.get("alt") or tag.get("title")) or None
            if extraction.publication is None:
                extraction.publication = _publication_from_label(label)
            existing = candidates.get(page_number)
            if existing is not None and (high_resolution.get(page_number) or not is_high_resolution):
                continue
            candidates[page_number] = NewspaperPage(
                page_number=page_number,
                image_url=image_url,
                label=label or f"Page {page_number}",
                alt=normalize_inline(tag.get("alt")) or None,
            )
            high_resolution[page_number] = is_high_resolution

        ordered = [candidates[number] for number in sorted(candidates)]
        if len(ordered) > self.max_pages:
            extraction.notes.append(
                f"The viewer exposed {len(ordered)} pages; only the first {self.max_pages} are included."
            )
            ordered = ordered[: self.max_pages]
        extraction.pages = ordered

        if extraction.pages:
            extraction.notes.append(
                f"Discovered {len(extraction.pages)} full newspaper pages in the publisher's public viewer."
            )
            if extraction.reported_page_count is not None and extraction.reported_page_count != len(
                extraction.pages
            ):
                extraction.notes.append(
                    f"The viewer reported {extraction.reported_page_count} pages, but "
                    f"{len(extraction.pages)} public page images were found."
                )
        return extraction

    @staticmethod
    def _reported_page_count(soup: BeautifulSoup) -> int | None:
        for input_element in soup.find_all("input"):
            field_id = str(input_element.get("id") or input_element.get("name") or "")
            if "pagecount" not in field_id.lower():
                continue
            match = re.search(r"\d+", str(input_element.get("value") or ""))
            if match:
                return int(match.group(0))
        return None
