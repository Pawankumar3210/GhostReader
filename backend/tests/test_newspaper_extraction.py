from app.services.article_analyzer import ArticleAnalyzer
from app.services.newspaper_extractor import NewspaperExtractor

VIEWER_HTML = """
<html>
  <body>
    <input type="hidden" id="hdnPageCount" value="3">
    <img src="/blank-page.gif" alt="VIJAY KARNATAKA Page No-1">
    <img img_low="/pages/1-low.avif" img_hires="/pages/1.avif"
         alt="VIJAY KARNATAKA Page No-1">
    <img img_low="/pages/2-low.avif" alt="VIJAY KARNATAKA Page No-2">
    <img img_hires="/pages/2.avif" alt="VIJAY KARNATAKA Page No-2">
    <img data-src="/pages/3.avif" title="VIJAY KARNATAKA Page No-3">
    <img src="javascript:void(0)" alt="VIJAY KARNATAKA Page No-4">
    <img src="/ads/banner.jpg" alt="Advertisement">
  </body>
</html>
"""


def test_extracts_sorted_public_page_images() -> None:
    extraction = NewspaperExtractor().extract(
        VIEWER_HTML, base_url="https://epaper.example.com/view?date=2026-11-10"
    )

    assert extraction.reported_page_count == 3
    assert extraction.publication == "VIJAY KARNATAKA"
    assert extraction.edition_date == "2026-11-10T12:00:00Z"
    assert [page.page_number for page in extraction.pages] == [1, 2, 3]
    assert [page.image_url for page in extraction.pages] == [
        "https://epaper.example.com/pages/1.avif",
        "https://epaper.example.com/pages/2.avif",
        "https://epaper.example.com/pages/3.avif",
    ]
    assert all(page.label and "Page No-" in page.label for page in extraction.pages)
    assert any("3 full newspaper pages" in note for note in extraction.notes)


def test_caps_page_count_and_reports_truncation() -> None:
    extraction = NewspaperExtractor(max_pages=2).extract(
        VIEWER_HTML, base_url="https://epaper.example.com/view"
    )

    assert [page.page_number for page in extraction.pages] == [1, 2]
    assert any("only the first 2" in note for note in extraction.notes)
    assert any("viewer reported 3 pages" in note for note in extraction.notes)


def test_ignores_pages_without_public_http_images() -> None:
    extraction = NewspaperExtractor().extract(
        '<img alt="Edition Page No-1"><img src="data:image/avif;base64,AAAA" alt="Page No-2">',
        base_url="https://epaper.example.com/view",
    )

    assert extraction.pages == []
    assert extraction.notes == []


def test_ignores_invalid_edition_dates() -> None:
    extraction = NewspaperExtractor().extract(
        VIEWER_HTML,
        base_url="https://epaper.example.com/view?pgdate=2026-02-31",
    )

    assert extraction.edition_date is None


def test_newspaper_metadata_is_readable() -> None:
    assert ArticleAnalyzer._tidy_newspaper_title("Vijay Karnataka - VIJAY KARNATAKA") == ("Vijay Karnataka")
    assert ArticleAnalyzer._tidy_publication("VIJAY KARNATAKA") == "Vijay Karnataka"
    assert ArticleAnalyzer._tidy_newspaper_title("The Hindu - 10 November 2026") == (
        "The Hindu - 10 November 2026"
    )
