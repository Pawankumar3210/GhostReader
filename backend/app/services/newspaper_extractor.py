from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import date
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit

from bs4 import BeautifulSoup, Tag

from app.core.errors import AppError
from app.schemas.analysis import NewspaperPage
from app.services.safe_fetcher import SafeFetcher
from app.utils.text import normalize_inline

logger = logging.getLogger(__name__)

_PAGE_NUMBER_RE = re.compile(
    r"\bpage\s*(?:no\.?|number|#)?\s*[-:#]?\s*(\d{1,3})\b",
    re.IGNORECASE,
)
_BLANK_IMAGE_HINTS = ("blankpage", "blank-page", "placeholder", "transparent.gif")
_PAGE_ATTRIBUTES = ("data-page-number", "data-page", "data-pagenumber")
_TELEGRAPH_PAGE_RE = re.compile(r"/(\d{4}-\d{2}-\d{2})/page-(\d{1,3})\.html$")
_HT_EDITION_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
_ERELEGO_API_URL = "https://enewspapr.com/epaper-api/epaper-api.php"
_ERELEGO_IMAGE_HOSTS = ("images.enewspapr.com",)
_ERELEGO_HOSTS = {
    "epaper.vijayavani.net": ("Vijayavani", "vijayavani"),
    "kpepaper.asianetnews.com": ("Kannada Prabha", "kannada-prabha"),
}
_ERELEGO_EDITION_RE = re.compile(
    r"^/edition/[^/]+/(?P<edition_id>[A-Za-z0-9_]+)"
    r"(?:/date/(?P<date>\d{4}-\d{2}-\d{2}))?/page/\d+/?$"
)


@dataclass
class NewspaperExtraction:
    pages: list[NewspaperPage] = field(default_factory=list)
    reported_page_count: int | None = None
    publication: str | None = None
    edition_date: str | None = None
    source: str | None = None
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


def _normalise_iso_date(value: object) -> str | None:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return None
    if not 1900 <= parsed.year <= 2200:
        return None
    return f"{value}T12:00:00Z"


def _positive_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        number = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _host_allowed(url: str, suffixes: tuple[str, ...]) -> bool:
    host = (urlsplit(url).hostname or "").lower()
    return any(host == suffix or host.endswith(f".{suffix}") for suffix in suffixes)


def _extract_telegraph(html: str, base_url: str) -> NewspaperExtraction | None:
    path = urlsplit(base_url).path
    page_match = _TELEGRAPH_PAGE_RE.search(path)
    if not page_match or not _host_allowed(base_url, ("telegraphindia.com",)):
        return None

    soup = BeautifulSoup(html, "lxml")
    candidates: dict[int, NewspaperPage] = {}
    for image in soup.find_all("img"):
        raw_source = image.get("data-src") or image.get("src")
        if not raw_source or "/webepaper/photos/thumbs/" not in raw_source:
            continue
        anchor = image.find_parent("a", href=True)
        if anchor is None:
            continue
        anchor_url = _absolute_url(str(anchor.get("href")), base_url)
        anchor_match = _TELEGRAPH_PAGE_RE.search(urlsplit(anchor_url or "").path)
        if anchor_match is None:
            continue
        if anchor_match.group(1) != page_match.group(1):
            continue
        page_number = int(anchor_match.group(2))
        thumbnail_url = _absolute_url(str(raw_source), base_url)
        if thumbnail_url is None:
            continue
        image_url = thumbnail_url.replace("/webepaper/photos/thumbs/", "/webepaper/photos/")
        if "/webepaper/photos/" not in urlsplit(image_url).path:
            continue
        if not _host_allowed(image_url, ("ttef.in", "telegraphindia.com")):
            continue
        label = normalize_inline(anchor.get_text(" ")) or f"Page {page_number}"
        candidates.setdefault(
            page_number,
            NewspaperPage(
                page_number=page_number,
                image_url=image_url,
                label=label,
                alt=normalize_inline(image.get("alt")) or None,
            ),
        )

    return NewspaperExtraction(
        pages=list(candidates.values()),
        reported_page_count=max(candidates) if candidates else None,
        publication="The Telegraph",
        edition_date=_normalise_iso_date(page_match.group(1)),
        source="telegraph",
    )


def _extract_hindustan_times(html: str, base_url: str) -> NewspaperExtraction | None:
    parsed_url = urlsplit(base_url)
    if (parsed_url.hostname or "").lower() != "epaper.hindustantimes.com":
        return None
    if not parsed_url.path.startswith("/edition/"):
        return None

    soup = BeautifulSoup(html, "lxml")
    script = soup.find("script", id="__NEXT_DATA__")
    if script is None or not script.string:
        return None
    try:
        payload = json.loads(script.string)
    except (TypeError, ValueError):
        return None
    page_props = payload.get("props", {}).get("pageProps", {}) if isinstance(payload, dict) else {}
    edition = page_props.get("edition") if isinstance(page_props, dict) else None
    if not isinstance(edition, dict):
        return None

    candidates: dict[int, NewspaperPage] = {}
    for item in edition.get("pages") or []:
        if not isinstance(item, dict):
            continue
        page_number = _positive_int(item.get("pageNumber"))
        if page_number is None:
            continue
        image_url = None
        for key in ("viewerSrc", "hrImageSrc", "portraitSrc", "landscapeSrc"):
            candidate = _absolute_url(item.get(key), base_url)
            if candidate and _host_allowed(candidate, ("hindustantimes.com", "livehindustan.com")):
                image_url = candidate
                break
        if image_url is None:
            continue
        label = normalize_inline(item.get("title") or item.get("section")) or f"Page {page_number}"
        candidates.setdefault(
            page_number,
            NewspaperPage(
                page_number=page_number,
                image_url=image_url,
                label=label,
                alt=normalize_inline(item.get("alt")) or None,
            ),
        )

    reported_page_count = _positive_int(edition.get("totalPages"))
    return NewspaperExtraction(
        pages=list(candidates.values()),
        reported_page_count=reported_page_count or (len(candidates) or None),
        publication="Hindustan Times",
        edition_date=_normalise_iso_date(edition.get("issueDateIso")),
        source="hindustan-times",
    )


class NewspaperExtractor:
    """Discovers publicly delivered page images in digital newspaper viewers."""

    def __init__(self, max_pages: int = 64) -> None:
        self.max_pages = max_pages

    def extract(self, html: str, *, base_url: str) -> NewspaperExtraction:
        extraction = _extract_telegraph(html, base_url)
        if extraction is None:
            extraction = _extract_hindustan_times(html, base_url)
        if extraction is None:
            extraction = self._extract_generic(html, base_url=base_url)
        return self._finalise(extraction)

    def _extract_generic(self, html: str, *, base_url: str) -> NewspaperExtraction:
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

        extraction.pages = list(candidates.values())
        return extraction

    def _finalise(self, extraction: NewspaperExtraction) -> NewspaperExtraction:
        return _finalise_extraction(extraction, max_pages=self.max_pages)

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


def _finalise_extraction(extraction: NewspaperExtraction, *, max_pages: int) -> NewspaperExtraction:
    ordered = sorted(extraction.pages, key=lambda page: page.page_number)
    if len(ordered) > max_pages:
        extraction.notes.append(
            f"The viewer exposed {len(ordered)} pages; only the first {max_pages} are included."
        )
        ordered = ordered[:max_pages]
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


@dataclass(frozen=True)
class _ErelegoTarget:
    edition_id: str
    edition_date: str | None
    publication: str
    source: str


def _erelego_target(url: str) -> _ErelegoTarget | None:
    parsed = urlsplit(url)
    publication = _ERELEGO_HOSTS.get((parsed.hostname or "").lower())
    if publication is None:
        return None
    match = _ERELEGO_EDITION_RE.match(parsed.path)
    if match is None:
        return None
    edition_date = match.group("date")
    if edition_date and _normalise_iso_date(edition_date) is None:
        return None
    return _ErelegoTarget(
        edition_id=match.group("edition_id"),
        edition_date=edition_date,
        publication=publication[0],
        source=publication[1],
    )


def _select_erelego_issue(payload: object, edition_id: str) -> dict | None:
    if isinstance(payload, dict):
        return payload
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict) and item.get("edition_id") == edition_id:
                return item
        for item in payload:
            if isinstance(item, dict):
                return item
    return None


def _empty_erelego_extraction(target: _ErelegoTarget | None, note: str) -> NewspaperExtraction:
    if target is None:
        return NewspaperExtraction(notes=[note])
    return NewspaperExtraction(
        publication=target.publication,
        edition_date=_normalise_iso_date(target.edition_date),
        source=target.source,
        notes=[note],
    )


class NewspaperSourceResolver:
    """Resolves public page manifests that the publisher delivers as JSON."""

    def __init__(self, fetcher: SafeFetcher, max_pages: int = 64) -> None:
        self.fetcher = fetcher
        self.max_pages = max_pages

    async def resolve(self, url: str) -> NewspaperExtraction | None:
        return await self._resolve_erelego(url)

    async def _resolve_erelego(self, url: str) -> NewspaperExtraction | None:
        target = _erelego_target(url)
        if target is None:
            return None

        query = urlencode(
            {
                "edid": target.edition_id,
                "edition_date": target.edition_date or "",
                "operation": "getEditionsWithIssueByEpaperId",
                "v": "1",
                "cache": "random",
            }
        )
        api_url = f"{_ERELEGO_API_URL}?{query}"
        try:
            response = await self.fetcher.fetch(api_url, allowed_content_types=("application/json",))
        except AppError as exc:
            logger.info("public e-paper index could not be fetched: %s", exc)
            return _empty_erelego_extraction(
                target,
                f"The publisher's public e-paper index could not be reached ({exc.message}).",
            )

        if response.status_code != 200:
            return _empty_erelego_extraction(
                target,
                f"The publisher's public e-paper index returned HTTP {response.status_code}.",
            )

        try:
            payload = json.loads(response.content.decode(response.charset or "utf-8-sig"))
        except (LookupError, UnicodeError, TypeError, ValueError):
            return _empty_erelego_extraction(
                target, "The publisher's public e-paper index returned an unreadable response."
            )

        issue = _select_erelego_issue(payload, target.edition_id)
        if issue is None:
            return _empty_erelego_extraction(
                target, "The publisher's public e-paper index did not identify an issue."
            )

        edition_date = _normalise_iso_date(issue.get("latest_issue_date")) or _normalise_iso_date(
            target.edition_date
        )
        if str(issue.get("isSubscriptionEnabled")).strip().upper() != "FALSE":
            return NewspaperExtraction(
                publication=target.publication,
                edition_date=edition_date,
                source=target.source,
                notes=[
                    "The publisher marks this edition as requiring a subscription, so its pages were not extracted."
                ],
            )

        candidates: dict[int, NewspaperPage] = {}
        pages = issue.get("pages")
        for item in pages if isinstance(pages, list) else []:
            if not isinstance(item, dict):
                continue
            page_number = _positive_int(item.get("pageno"))
            if page_number is None:
                continue
            image_url = None
            for key in ("r2fullImagePath", "r2fullImagePathPage", "fullImagePath"):
                raw_url = item.get(key)
                candidate = _absolute_url(raw_url if isinstance(raw_url, str) else None, url)
                if candidate and _host_allowed(candidate, _ERELEGO_IMAGE_HOSTS):
                    image_url = candidate
                    break
            if image_url is None:
                continue
            label = normalize_inline(item.get("pagename")) or f"Page {page_number}"
            candidates.setdefault(
                page_number,
                NewspaperPage(
                    page_number=page_number,
                    image_url=image_url,
                    label=label,
                ),
            )

        extraction = NewspaperExtraction(
            pages=list(candidates.values()),
            reported_page_count=len(candidates) or None,
            publication=target.publication,
            edition_date=edition_date,
            source=target.source,
        )
        if not extraction.pages:
            extraction.notes.append(
                "The publisher's public e-paper index did not expose page image URLs for this edition."
            )
        return _finalise_extraction(extraction, max_pages=self.max_pages)
