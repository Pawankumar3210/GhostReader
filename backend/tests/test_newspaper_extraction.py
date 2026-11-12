from app.schemas.enums import PageType
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


TELEGRAPH_HTML = """
<html>
  <body>
    <img src="https://assets-abp.ttef.in/ttlive/20261111/webepaper/photos/661328.png">
    <div id="thumbnaillistview">
      <ul>
        <li><a href="/calcutta-edition/29/2026-11-11/page-2.html">
          <img src="/placeholder.jpg"
               data-src="https://assets-abp.ttef.in/ttlive/20261111/webepaper/photos/thumbs/661329.png"
               alt="page-2.html">
          <div class="txt-tlv">Page 2</div>
        </a></li>
        <li><a href="/calcutta-edition/29/2026-11-11/page-1.html">
          <img src="/placeholder.jpg"
               data-src="https://assets-abp.ttef.in/ttlive/20261111/webepaper/photos/thumbs/661328.png"
               alt="page-1.html">
          <div class="txt-tlv">Front Page</div>
        </a></li>
        <li><a href="/calcutta-edition/29/2026-11-11/page-3.html">
          <img src="/placeholder.jpg"
               data-src="https://assets-abp.ttef.in/ttlive/20261111/webepaper/photos/thumbs/661330.png"
               alt="page-3.html">
          <div class="txt-tlv">Page 3</div>
        </a></li>
        <li><a href="/calcutta-edition/29/2026-11-10/page-4.html">
          <img src="/placeholder.jpg"
               data-src="https://assets-abp.ttef.in/ttlive/20261110/webepaper/photos/thumbs/661331.png">
        </a></li>
      </ul>
    </div>
  </body>
</html>
"""


def test_extracts_telegraph_full_page_images_from_public_thumbnails() -> None:
    extraction = NewspaperExtractor().extract(
        TELEGRAPH_HTML,
        base_url="https://epaper.telegraphindia.com/calcutta-edition/29/2026-11-11/page-1.html",
    )

    assert extraction.publication == "The Telegraph"
    assert extraction.source == "telegraph"
    assert extraction.edition_date == "2026-11-11T12:00:00Z"
    assert extraction.reported_page_count == 3
    assert [page.page_number for page in extraction.pages] == [1, 2, 3]
    assert [page.image_url for page in extraction.pages] == [
        "https://assets-abp.ttef.in/ttlive/20261111/webepaper/photos/661328.png",
        "https://assets-abp.ttef.in/ttlive/20261111/webepaper/photos/661329.png",
        "https://assets-abp.ttef.in/ttlive/20261111/webepaper/photos/661330.png",
    ]
    assert extraction.pages[0].label == "Front Page"
    assert any("3 full newspaper pages" in note for note in extraction.notes)


HT_DATA = {
    "props": {
        "pageProps": {
            "edition": {
                "city": {"slug": "mumbai", "name": "Mumbai", "editionCode": "HT_MUMB"},
                "issueDateIso": "2026-11-10",
                "totalPages": 3,
                "pages": [
                    {
                        "pageNumber": 3,
                        "title": "Sports",
                        "viewerSrc": "https://epaper.hindustantimes.com/ep-img/page-3_hr.webp",
                        "alt": "Mumbai ePaper Page 3",
                    },
                    {
                        "pageNumber": 1,
                        "title": "Page 1",
                        "portraitSrc": "https://epaper.hindustantimes.com/ep-img/page-1_p.webp",
                        "viewerSrc": "https://epaper.hindustantimes.com/ep-img/page-1_hr.webp",
                    },
                    {
                        "pageNumber": 2,
                        "title": "Page 2",
                        "portraitSrc": "https://epaper.hindustantimes.com/ep-img/page-2_p.webp",
                    },
                    {
                        "pageNumber": 4,
                        "title": "Page 4",
                        "viewerSrc": "https://example.invalid/page-4.webp",
                    },
                ],
            }
        }
    }
}

HT_HTML = (
    '<html><head><script id="__NEXT_DATA__" type="application/json">'
    + __import__("json").dumps(HT_DATA)
    + "</script></head><body></body></html>"
)


def test_extracts_hindustan_times_pages_from_next_data() -> None:
    extraction = NewspaperExtractor().extract(
        HT_HTML,
        base_url="https://epaper.hindustantimes.com/edition/mumbai?date=2026-11-10&page=1",
    )

    assert extraction.publication == "Hindustan Times"
    assert extraction.source == "hindustan-times"
    assert extraction.edition_date == "2026-11-10T12:00:00Z"
    assert extraction.reported_page_count == 3
    assert [page.page_number for page in extraction.pages] == [1, 2, 3]
    assert [page.image_url for page in extraction.pages] == [
        "https://epaper.hindustantimes.com/ep-img/page-1_hr.webp",
        "https://epaper.hindustantimes.com/ep-img/page-2_p.webp",
        "https://epaper.hindustantimes.com/ep-img/page-3_hr.webp",
    ]
    assert any("3 full newspaper pages" in note for note in extraction.notes)


def test_known_epaper_hosts_are_classified_before_article_metadata() -> None:
    from bs4 import BeautifulSoup

    from app.services.metadata_extractor import MetadataExtractor
    from app.services.page_classifier import PageClassifier
    from tests.conftest import load_fixture

    html = load_fixture("public_article.html")
    metadata = MetadataExtractor().extract(html, base_url="https://lab-herald.invalid/news/coastal-wetlands")
    classification = PageClassifier().classify(
        url="https://epaper.hindustantimes.com/edition/mumbai?date=2026-11-10&page=1",
        content_type="text/html",
        metadata=metadata,
        soup=BeautifulSoup(html, "lxml"),
    )

    assert classification.page_type == PageType.NEWSPAPER_VIEWER


ERELEGO_ISSUE = {
    "edition_id": "KANPRABHA_MN",
    "name": "MANGALORE",
    "latest_issue_id": "KANPRABHA_MN_20261110",
    "latest_issue_date": "2026-11-10",
    "isSubscriptionEnabled": "FALSE",
    "pages": [
        {
            "pageno": "2",
            "r2fullImagePath": "https://images.enewspapr.com/eNewspaper/News/KANPRABHA/MN/page-2.jpg",
        },
        {
            "pageno": "1",
            "fullImagePath": "https://www.enewspapr.com/News/KANPRABHA/MN/page-1.jpg",
        },
        {
            "pageno": "3",
            "fullImagePath": "https://images.enewspapr.com/eNewspaper/News/KANPRABHA/MN/page-3.jpg",
        },
    ],
}


def _erelego_resolver(settings, payload, *, max_pages=64):  # type: ignore[no-untyped-def]
    import httpx

    from app.services.newspaper_extractor import NewspaperSourceResolver
    from app.services.safe_fetcher import SafeFetcher
    from app.services.url_validator import URLValidator
    from tests.conftest import fake_resolver

    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(request.url.params)
        return httpx.Response(
            200,
            headers={"Content-Type": "application/json"},
            json=payload,
        )

    validator = URLValidator(
        allowed_ports={443},
        resolver=fake_resolver({"enewspapr.com": ["93.184.216.34"]}),
        resolution_timeout=1.0,
    )
    fetcher = SafeFetcher(settings, validator, transport=httpx.MockTransport(handler))
    return NewspaperSourceResolver(fetcher, max_pages=max_pages), captured


async def test_resolves_erelego_public_pages_from_api(settings) -> None:  # type: ignore[no-untyped-def]
    resolver, captured = _erelego_resolver(settings, ERELEGO_ISSUE)

    extraction = await resolver.resolve(
        "https://kpepaper.asianetnews.com/edition/MANGALORE/KANPRABHA_MN/date/2026-11-10/page/1"
    )

    assert extraction is not None
    assert extraction.publication == "Kannada Prabha"
    assert extraction.source == "kannada-prabha"
    assert extraction.edition_date == "2026-11-10T12:00:00Z"
    assert extraction.reported_page_count == 2
    assert [page.page_number for page in extraction.pages] == [2, 3]
    assert [page.image_url for page in extraction.pages] == [
        "https://images.enewspapr.com/eNewspaper/News/KANPRABHA/MN/page-2.jpg",
        "https://images.enewspapr.com/eNewspaper/News/KANPRABHA/MN/page-3.jpg",
    ]
    assert captured["edid"] == "KANPRABHA_MN"
    assert captured["edition_date"] == "2026-11-10"
    assert captured["operation"] == "getEditionsWithIssueByEpaperId"


async def test_erelego_latest_issue_uses_empty_date_and_caps_pages(settings) -> None:  # type: ignore[no-untyped-def]
    payload = dict(
        ERELEGO_ISSUE,
        edition_id="VVAANINEW_BEN",
        isSubscriptionEnabled="FALSE",
    )
    resolver, captured = _erelego_resolver(settings, payload, max_pages=1)

    extraction = await resolver.resolve(
        "https://epaper.vijayavani.net/edition/BENGALURU/VVAANINEW_BEN/page/1"
    )

    assert extraction is not None
    assert extraction.publication == "Vijayavani"
    assert extraction.source == "vijayavani"
    assert captured["edition_date"] == ""
    assert len(extraction.pages) == 1
    assert any("only the first 1" in note for note in extraction.notes)


async def test_erelego_subscription_edition_is_not_extracted(settings) -> None:  # type: ignore[no-untyped-def]
    resolver, _ = _erelego_resolver(
        settings,
        dict(ERELEGO_ISSUE, isSubscriptionEnabled="TRUE"),
    )

    extraction = await resolver.resolve(
        "https://kpepaper.asianetnews.com/edition/MANGALORE/KANPRABHA_MN/page/1"
    )

    assert extraction is not None
    assert extraction.pages == []
    assert any("subscription" in note.lower() for note in extraction.notes)


def test_erelego_hosts_are_classified_as_newspaper_viewers() -> None:
    from app.services.page_classifier import PageClassifier

    for url in (
        "https://kpepaper.asianetnews.com/edition/MANGALORE/KANPRABHA_MN/page/1",
        "https://epaper.vijayavani.net/edition/BENGALURU/VVAANINEW_BEN/page/1",
    ):
        classification = PageClassifier().classify(url=url, content_type="text/html")
        assert classification.page_type == PageType.NEWSPAPER_VIEWER
