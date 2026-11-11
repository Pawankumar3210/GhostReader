from __future__ import annotations

from app.schemas.enums import AccessStatus
from app.services.access_assessor import AccessAssessor, page_has_password_form
from app.services.article_extractor import ArticleExtractor
from app.services.metadata_extractor import MetadataExtractor
from tests.conftest import load_fixture

BASE = "https://lab-herald.invalid/news/story"


def assess(html: str, *, status_code: int = 200):  # type: ignore[no-untyped-def]
    metadata = MetadataExtractor().extract(html, base_url=BASE)
    extraction = ArticleExtractor().extract(html, base_url=BASE, title=metadata.title)
    return AccessAssessor().assess(
        status_code=status_code,
        html=html,
        metadata=metadata,
        extraction=extraction,
        content_type="text/html",
        has_password_form=page_has_password_form(html),
    )


def test_public_full() -> None:
    assessment = assess(load_fixture("public_article.html"))
    assert assessment.status == AccessStatus.PUBLIC_FULL
    assert assessment.confidence == "high"
    assert "extracted" in assessment.explanation.lower()


def test_public_partial_preview() -> None:
    assessment = assess(load_fixture("partial_preview.html"))
    assert assessment.status == AccessStatus.PUBLIC_PARTIAL
    assert any("subscrib" in item.lower() for item in assessment.evidence)


def test_subscription_required_without_meaningful_preview() -> None:
    assessment = assess(load_fixture("paywall.html"))
    assert assessment.status == AccessStatus.SUBSCRIPTION_REQUIRED
    assert any("isAccessibleForFree" in item for item in assessment.evidence)


def test_login_required() -> None:
    assessment = assess(load_fixture("login_required.html"))
    assert assessment.status == AccessStatus.LOGIN_REQUIRED
    assert any("password" in item.lower() for item in assessment.evidence)


def test_js_required() -> None:
    assessment = assess(load_fixture("js_required.html"))
    assert assessment.status == AccessStatus.JS_REQUIRED


def test_access_challenge() -> None:
    assessment = assess(load_fixture("challenge.html"))
    assert assessment.status == AccessStatus.ACCESS_CHALLENGE
    assert assessment.confidence == "high"


def test_403_is_not_automatically_a_paywall() -> None:
    assessment = assess(
        "<html><body><h1>Forbidden</h1><p>Request refused.</p></body></html>", status_code=403
    )
    assert assessment.status == AccessStatus.ACCESS_CHALLENGE
    assert assessment.confidence == "medium"
    assert "not necessarily a paywall" in assessment.explanation or "not proof" in assessment.explanation


def test_404_and_500_are_technical_failures() -> None:
    html = "<html><body><p>Plain error page.</p></body></html>"
    assert assess(html, status_code=404).status == AccessStatus.FETCH_FAILED
    assert assess(html, status_code=503).status == AccessStatus.FETCH_FAILED


def test_password_form_detection() -> None:
    assert page_has_password_form(load_fixture("login_required.html"))
    assert not page_has_password_form(load_fixture("public_article.html"))


def test_unsupported_non_html_content() -> None:
    from app.services.article_extractor import ArticleExtraction

    assessment = AccessAssessor().assess(
        status_code=200,
        html="",
        metadata=MetadataExtractor().extract("", base_url=BASE),
        extraction=ArticleExtraction(),
        content_type="application/zip",
    )
    assert assessment.status == AccessStatus.UNSUPPORTED
