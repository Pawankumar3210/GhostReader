from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit

import trafilatura
from bs4 import BeautifulSoup, Tag

from app.schemas.analysis import ContentBlock, ImageReference
from app.schemas.enums import BlockType
from app.utils.text import clean_text, count_words, dedupe_preserve, normalize_inline, reading_time_minutes

logger = logging.getLogger(__name__)

_BOILERPLATE_RE = re.compile(
    r"^(advertisement|advertisements|skip to content|menu|share this( article| story)?|"
    r"follow us|sign up( for)? .{0,40}|subscribe( now)?|cookie(s)? .{0,40}|all rights reserved\.?|"
    r"read more|related( articles| stories| coverage)?|photo(graph)?:? .{0,80}|image:? .{0,80})$",
    re.IGNORECASE,
)
_TRACKING_PIXEL_HINTS = ("pixel", "tracking", "spacer", "blank.gif", "1x1")


@dataclass
class ArticleExtraction:
    blocks: list[ContentBlock] = field(default_factory=list)
    text: str = ""
    word_count: int = 0
    reading_time_minutes: int = 0
    extractor: str = "trafilatura"
    images: list[ImageReference] = field(default_factory=list)
    links: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def _absolute_image(raw: str | None, base_url: str) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    if not raw or raw.startswith("data:"):
        return None
    absolute = urljoin(base_url, raw)
    try:
        parsed = urlsplit(absolute)
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    if any(hint in absolute.lower() for hint in _TRACKING_PIXEL_HINTS):
        return None
    return absolute


def _int_or_none(value: str | None) -> int | None:
    if not value:
        return None
    match = re.match(r"\s*(\d+)", value)
    return int(match.group(1)) if match else None


def _image_from_tag(tag: Tag, base_url: str) -> ImageReference | None:
    source = tag.get("src") or tag.get("data-src") or tag.get("data-lazy-src") or tag.get("data-original")
    if not source and tag.get("srcset"):
        source = str(tag.get("srcset")).split(",")[0].strip().split(" ")[0]
    url = _absolute_image(source, base_url)
    if not url:
        return None
    width = _int_or_none(tag.get("width"))
    height = _int_or_none(tag.get("height"))
    if width is not None and height is not None and width < 60 and height < 60:
        return None
    return ImageReference(
        url=url,
        alt=normalize_inline(tag.get("alt")) or None,
        width=width,
        height=height,
    )


class ArticleExtractor:
    def __init__(self, max_images: int = 24) -> None:
        self.max_images = max_images

    def extract(
        self,
        html: str,
        *,
        base_url: str,
        title: str | None = None,
    ) -> ArticleExtraction:
        extraction = ArticleExtraction()
        image_meta = self._image_metadata_map(html, base_url)
        try:
            extracted_html = trafilatura.extract(
                html,
                url=base_url,
                output_format="html",
                include_images=True,
                include_links=True,
                include_comments=False,
                include_tables=True,
                include_formatting=False,
                favor_precision=True,
                deduplicate=True,
            )
        except Exception as exc:  # pragma: no cover - library edge cases
            logger.warning("Primary extraction failed: %s", exc)
            extracted_html = None

        if extracted_html:
            extraction.extractor = "trafilatura"
            self._blocks_from_fragment(extracted_html, base_url, extraction, title, image_meta)
        if not extraction.blocks:
            extraction.extractor = "beautifulsoup"
            extraction.notes.append(
                "The primary reader-extraction strategy did not find an article body; a conservative HTML fallback was used."
            )
            self._fallback_extract(html, base_url, extraction, title, image_meta)

        self._finalize(extraction, title)
        return extraction

    def _image_metadata_map(self, html: str, base_url: str) -> dict[str, dict[str, object]]:
        soup = BeautifulSoup(html, "lxml")
        metadata: dict[str, dict[str, object]] = {}
        for figure in soup.find_all("figure"):
            img_tag = figure.find("img")
            if not img_tag:
                continue
            image = _image_from_tag(img_tag, base_url)
            if not image:
                continue
            caption_tag = figure.find("figcaption")
            caption = normalize_inline(caption_tag.get_text(" ", strip=True)) if caption_tag else None
            metadata.setdefault(
                image.url,
                {
                    "caption": caption,
                    "alt": image.alt,
                    "width": image.width,
                    "height": image.height,
                },
            )
        return metadata

    @staticmethod
    def _apply_image_metadata(image: ImageReference, image_meta: dict[str, dict[str, object]] | None) -> None:
        if not image_meta:
            return
        details = image_meta.get(image.url)
        if not details:
            return
        image.caption = image.caption or (
            details.get("caption") if isinstance(details.get("caption"), str) else None
        )
        image.alt = image.alt or (details.get("alt") if isinstance(details.get("alt"), str) else None)
        image.width = image.width or (details.get("width") if isinstance(details.get("width"), int) else None)
        image.height = image.height or (
            details.get("height") if isinstance(details.get("height"), int) else None
        )

    def _blocks_from_fragment(
        self,
        fragment_html: str,
        base_url: str,
        extraction: ArticleExtraction,
        title: str | None,
        image_meta: dict[str, dict[str, object]] | None = None,
    ) -> None:
        soup = BeautifulSoup(fragment_html, "lxml")
        root = soup.find("doc") or soup
        blocks: list[ContentBlock] = []

        for element in root.find_all(
            ["h1", "h2", "h3", "h4", "h5", "h6", "p", "blockquote", "ul", "ol", "figure", "img"]
        ):
            name = element.name
            if name == "img":
                if element.find_parent(["figure", "picture"]):
                    continue
                image = _image_from_tag(element, base_url)
                if image:
                    self._apply_image_metadata(image, image_meta)
                    blocks.append(
                        ContentBlock(
                            type=BlockType.IMAGE,
                            image_url=image.url,
                            alt=image.alt,
                            caption=image.caption,
                        )
                    )
                    extraction.images.append(image)
                continue
            if name == "p" and element.find_parent("blockquote"):
                continue
            if name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
                text = normalize_inline(element.get_text(" ", strip=True))
                if text:
                    level = 2 if name in {"h1", "h2"} else 3
                    block_type = BlockType.HEADING if level == 2 else BlockType.SUBHEADING
                    blocks.append(ContentBlock(type=block_type, text=text, level=level))
                continue
            if name == "p":
                text = clean_text(element.get_text(" ", strip=True))
                if text and not _BOILERPLATE_RE.match(text):
                    blocks.append(ContentBlock(type=BlockType.PARAGRAPH, text=text))
                continue
            if name == "blockquote":
                text = clean_text(element.get_text(" ", strip=True))
                if text:
                    blocks.append(ContentBlock(type=BlockType.QUOTE, text=text))
                continue
            if name in {"ul", "ol"}:
                items = dedupe_preserve(
                    clean_text(item.get_text(" ", strip=True)) for item in element.find_all("li")
                )
                items = [item for item in items if item and not _BOILERPLATE_RE.match(item)]
                if items:
                    blocks.append(ContentBlock(type=BlockType.LIST, items=items))
                continue
            if name == "figure":
                image = None
                img_tag = element.find("img")
                if img_tag:
                    image = _image_from_tag(img_tag, base_url)
                    if image:
                        self._apply_image_metadata(image, image_meta)
                caption_tag = element.find("figcaption")
                caption = normalize_inline(caption_tag.get_text(" ", strip=True)) if caption_tag else None
                if image:
                    image.caption = caption
                    blocks.append(
                        ContentBlock(
                            type=BlockType.IMAGE,
                            image_url=image.url,
                            alt=image.alt,
                            caption=caption,
                        )
                    )
                    extraction.images.append(image)
                elif caption:
                    blocks.append(ContentBlock(type=BlockType.CAPTION, text=caption))

        for link in root.find_all("a", href=True):
            href = str(link.get("href"))
            if href.startswith(("http://", "https://")):
                extraction.links.append(href)
            elif href.startswith("/") and base_url:
                extraction.links.append(urljoin(base_url, href))

        extraction.links = dedupe_preserve(extraction.links)[:20]
        extraction.blocks.extend(blocks)

    def _fallback_extract(
        self,
        html: str,
        base_url: str,
        extraction: ArticleExtraction,
        title: str | None,
        image_meta: dict[str, dict[str, object]] | None = None,
    ) -> None:
        soup = BeautifulSoup(html, "lxml")
        for tag in soup(["script", "style", "noscript", "nav", "aside", "footer", "form", "iframe"]):
            tag.decompose()

        candidates: list[Tag] = []
        for selector in (
            "article",
            "[role='main']",
            "main",
            "div.article-body",
            "div.article__body",
            "div.story-body",
            "div.entry-content",
            "div.post-content",
            "div.content",
            "body",
        ):
            found = soup.select(selector)
            if found:
                candidates.extend(found)
        if not candidates:
            candidates = [soup]

        def score(tag: Tag) -> int:
            paragraphs = tag.find_all("p")
            text_length = len(normalize_inline(tag.get_text(" ", strip=True)))
            return text_length + len(paragraphs) * 120

        best = max(candidates, key=score)
        for element in best.find_all(
            ["h1", "h2", "h3", "h4", "p", "blockquote", "ul", "ol", "figure", "img"]
        ):
            name = element.name
            if name == "img":
                if element.find_parent(["figure", "picture"]):
                    continue
                image = _image_from_tag(element, base_url)
                if image:
                    self._apply_image_metadata(image, image_meta)
                    extraction.blocks.append(
                        ContentBlock(
                            type=BlockType.IMAGE,
                            image_url=image.url,
                            alt=image.alt,
                            caption=image.caption,
                        )
                    )
                    extraction.images.append(image)
                continue
            if name in {"h1", "h2", "h3", "h4"}:
                text = normalize_inline(element.get_text(" ", strip=True))
                if text:
                    level = 2 if name in {"h1", "h2"} else 3
                    block_type = BlockType.HEADING if level == 2 else BlockType.SUBHEADING
                    extraction.blocks.append(ContentBlock(type=block_type, text=text, level=level))
                continue
            if name == "p":
                text = clean_text(element.get_text(" ", strip=True))
                if len(text) >= 25 and not _BOILERPLATE_RE.match(text):
                    extraction.blocks.append(ContentBlock(type=BlockType.PARAGRAPH, text=text))
                continue
            if name == "blockquote":
                text = clean_text(element.get_text(" ", strip=True))
                if text:
                    extraction.blocks.append(ContentBlock(type=BlockType.QUOTE, text=text))
                continue
            if name in {"ul", "ol"}:
                items = dedupe_preserve(
                    clean_text(item.get_text(" ", strip=True)) for item in element.find_all("li")
                )
                items = [item for item in items if item and len(item) < 500]
                if items:
                    extraction.blocks.append(ContentBlock(type=BlockType.LIST, items=items))
                continue
            if name == "figure":
                img_tag = element.find("img")
                image = _image_from_tag(img_tag, base_url) if img_tag else None
                if image:
                    self._apply_image_metadata(image, image_meta)
                caption_tag = element.find("figcaption")
                caption = normalize_inline(caption_tag.get_text(" ", strip=True)) if caption_tag else None
                if image:
                    image.caption = caption
                    extraction.blocks.append(
                        ContentBlock(
                            type=BlockType.IMAGE,
                            image_url=image.url,
                            alt=image.alt,
                            caption=caption,
                        )
                    )
                    extraction.images.append(image)
                elif caption:
                    extraction.blocks.append(ContentBlock(type=BlockType.CAPTION, text=caption))

        for link in best.find_all("a", href=True):
            href = str(link.get("href"))
            if href.startswith(("http://", "https://")):
                extraction.links.append(href)
        extraction.links = dedupe_preserve(extraction.links)[:20]

    @staticmethod
    def _prune_chrome_images(blocks: list[ContentBlock], title: str | None) -> list[ContentBlock]:
        content_indexes = [
            index
            for index, block in enumerate(blocks)
            if block.type != BlockType.IMAGE and (block.text or block.items)
        ]
        if not content_indexes:
            return blocks

        first_content = content_indexes[0]
        last_content = content_indexes[-1]
        normalized_title = normalize_inline(title).casefold() if title else ""
        pruned: list[ContentBlock] = []
        for index, block in enumerate(blocks):
            if block.type == BlockType.IMAGE and not block.caption:
                alt = normalize_inline(block.alt).casefold() if block.alt else ""
                outside_article = index < first_content or index > last_content
                duplicates_title = bool(normalized_title and alt == normalized_title)
                if outside_article and (not alt or duplicates_title):
                    continue
            pruned.append(block)
        return pruned

    def _finalize(self, extraction: ArticleExtraction, title: str | None) -> None:
        normalized_title = normalize_inline(title) if title else ""
        extraction.blocks = self._prune_chrome_images(extraction.blocks, title)
        block_image_urls = {block.image_url for block in extraction.blocks if block.type == BlockType.IMAGE}
        extraction.images = [image for image in extraction.images if image.url in block_image_urls]
        cleaned_blocks: list[ContentBlock] = []
        previous_signature: str | None = None

        for block in extraction.blocks:
            if (
                block.type == BlockType.HEADING
                and normalized_title
                and normalize_inline(block.text) == normalized_title
                and not cleaned_blocks
            ):
                continue
            signature = (
                f"{block.type}:{block.text or ''}:{block.image_url or ''}:{','.join(block.items or [])}"
            )
            if signature == previous_signature:
                continue
            if (
                block.type in {BlockType.PARAGRAPH, BlockType.HEADING, BlockType.SUBHEADING, BlockType.QUOTE}
                and not block.text
            ):
                continue
            if block.type == BlockType.LIST and not block.items:
                continue
            if block.type == BlockType.IMAGE and not block.image_url:
                continue
            cleaned_blocks.append(block)
            previous_signature = signature

        extraction.blocks = cleaned_blocks
        text_parts: list[str] = []
        for block in cleaned_blocks:
            if block.text:
                text_parts.append(block.text)
            if block.items:
                text_parts.extend(block.items)
        extraction.text = "\n\n".join(text_parts)
        extraction.word_count = count_words(extraction.text)
        extraction.reading_time_minutes = reading_time_minutes(extraction.word_count)

        seen_images: set[str] = set()
        unique_images: list[ImageReference] = []
        for image in extraction.images:
            if image.url in seen_images:
                continue
            seen_images.add(image.url)
            unique_images.append(image)
            if len(unique_images) >= self.max_images:
                break
        extraction.images = unique_images
