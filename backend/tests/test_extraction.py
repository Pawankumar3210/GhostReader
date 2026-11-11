from __future__ import annotations

from bs4 import BeautifulSoup

from app.schemas.analysis import ContentBlock
from app.schemas.enums import BlockType, PageType
from app.services.article_extractor import ArticleExtractor
from app.services.metadata_extractor import MetadataExtractor
from app.services.page_classifier import PageClassifier
from tests.conftest import load_fixture

BASE = "https://lab-herald.invalid/news/coastal-wetlands"


def test_metadata_extraction_merges_sources() -> None:
    metadata = MetadataExtractor().extract(load_fixture("public_article.html"), base_url=BASE)
    assert metadata.title == "Coastal Wetlands Receive New Protection"
    assert metadata.publisher == "The Lab Herald"
    assert metadata.author == "Dr Maya Rao"
    assert metadata.published_at and metadata.published_at.startswith("2026-02-14")
    assert metadata.canonical_url == "https://lab-herald.invalid/news/coastal-wetlands"
    assert metadata.featured_image == "https://cdn.lab-herald.invalid/wetlands.jpg"
    assert metadata.language == "en"
    assert "NewsArticle" in metadata.json_ld_types
    assert metadata.is_accessible_for_free is True


def test_metadata_marks_paywall_and_json_ld_article_body() -> None:
    metadata = MetadataExtractor().extract(load_fixture("paywall.html"), base_url=BASE)
    assert metadata.is_accessible_for_free is False
    assert metadata.has_article_body_ld is True
    assert metadata.article_body_ld_length > 20


def test_article_extraction_builds_structured_blocks() -> None:
    html = load_fixture("public_article.html")
    metadata = MetadataExtractor().extract(html, base_url=BASE)
    extraction = ArticleExtractor().extract(html, base_url=BASE, title=metadata.title)
    types = [block.type for block in extraction.blocks]
    assert BlockType.PARAGRAPH in types
    assert BlockType.HEADING in types or BlockType.SUBHEADING in types
    assert BlockType.QUOTE in types
    assert BlockType.LIST in types
    assert BlockType.IMAGE in types
    assert extraction.word_count > 100
    assert extraction.reading_time_minutes >= 1
    assert extraction.extractor == "trafilatura"
    assert any(image.caption for image in extraction.images)
    assert "Most read" not in extraction.text
    assert "© 2026" not in extraction.text
    image_blocks = [block for block in extraction.blocks if block.type == BlockType.IMAGE]
    assert image_blocks[0].image_url == "https://lab-herald.invalid/images/wetland-map.png"


def test_site_chrome_images_are_removed_without_dropping_article_images() -> None:
    title = "The Need to Read"
    blocks = [
        ContentBlock(type=BlockType.IMAGE, image_url="https://example.invalid/nav-ribbon.gif"),
        ContentBlock(type=BlockType.IMAGE, image_url="https://example.invalid/title.gif", alt=title),
        ContentBlock(type=BlockType.PARAGRAPH, text="A substantive opening paragraph."),
        ContentBlock(type=BlockType.IMAGE, image_url="https://example.invalid/inline.gif"),
        ContentBlock(
            type=BlockType.IMAGE, image_url="https://example.invalid/captioned.gif", caption="A map"
        ),
        ContentBlock(type=BlockType.PARAGRAPH, text="A substantive closing paragraph."),
        ContentBlock(type=BlockType.IMAGE, image_url="https://example.invalid/footer.gif"),
    ]

    pruned = ArticleExtractor._prune_chrome_images(blocks, title)

    urls = [block.image_url for block in pruned if block.type == BlockType.IMAGE]
    assert urls == ["https://example.invalid/inline.gif", "https://example.invalid/captioned.gif"]


def test_json_ld_article_body_is_not_used_as_content() -> None:
    html = load_fixture("paywall.html")
    extraction = ArticleExtractor().extract(html, base_url=BASE)
    assert "Synthetic subscriber-only article body" not in extraction.text


def test_page_classifier() -> None:
    classifier = PageClassifier()
    html = load_fixture("public_article.html")
    metadata = MetadataExtractor().extract(html, base_url=BASE)
    soup = BeautifulSoup(html, "lxml")
    news = classifier.classify(url=BASE, content_type="text/html", metadata=metadata, soup=soup)
    assert news.page_type == PageType.NEWS_ARTICLE
    assert news.confidence == "high"

    blog_html = load_fixture("blog_article.html")
    blog_metadata = MetadataExtractor().extract(blog_html, base_url="https://blog-site.invalid/post")
    blog = classifier.classify(
        url="https://blog-site.invalid/post",
        content_type="text/html",
        metadata=blog_metadata,
        soup=BeautifulSoup(blog_html, "lxml"),
    )
    assert blog.page_type == PageType.BLOG_ARTICLE

    pdf = classifier.classify(url="https://lab-herald.invalid/edition.pdf", content_type="application/pdf")
    image = classifier.classify(url="https://lab-herald.invalid/page.png", content_type="image/png")
    assert pdf.page_type == PageType.PDF_DOCUMENT
    assert image.page_type == PageType.IMAGE_DOCUMENT


def test_fallback_extraction_when_primary_fails(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    import trafilatura

    monkeypatch.setattr(trafilatura, "extract", lambda *args, **kwargs: None)
    html = load_fixture("public_article.html")
    extraction = ArticleExtractor().extract(html, base_url=BASE)
    assert extraction.extractor == "beautifulsoup"
    assert extraction.word_count > 50
    assert "Wetlands are not empty land" in extraction.text
