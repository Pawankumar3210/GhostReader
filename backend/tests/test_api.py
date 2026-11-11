from __future__ import annotations

import io
import time
from pathlib import Path

import pymupdf
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.schemas.analysis import AccessAssessment, AnalysisResult, ContentBlock
from app.schemas.enums import AccessStatus, BlockType, Confidence, PageType
from tests.conftest import fake_resolver


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def _prepare_resolver(client: TestClient) -> None:
    services = client.app.state.services
    resolver = fake_resolver({"news-site.com": ["93.184.216.34"]})
    services.validator._resolver = resolver
    services.analyzer.validator._resolver = resolver
    services.fetcher.validator._resolver = resolver


def _fake_analysis(url: str) -> AnalysisResult:
    assessment = AccessAssessment(
        status=AccessStatus.PUBLIC_FULL,
        confidence=Confidence.HIGH,
        explanation="A substantial public article body was extracted.",
        evidence=["Synthetic test result"],
    )
    return AnalysisResult(
        source_url=url,
        canonical_url=url,
        publisher="News Site",
        title="Test article",
        description="Testing the job pipeline.",
        language="en",
        content_type=PageType.NEWS_ARTICLE,
        access_status=AccessStatus.PUBLIC_FULL,
        content=[
            ContentBlock(
                type=BlockType.PARAGRAPH,
                text="This is a synthetic paragraph used to test the API job pipeline.",
            )
        ],
        images=[],
        source_metadata={"test": True},
        access_assessment=assessment,
        word_count=12,
        reading_time_minutes=1,
    )


def _poll(client: TestClient, path: str, timeout: float = 8.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        response = client.get(path)
        assert response.status_code == 200, response.text
        payload = response.json()
        if payload["status"] in {"SUCCEEDED", "FAILED", "CANCELLED"}:
            return payload
        time.sleep(0.05)
    raise AssertionError(f"Timed out waiting for {path}")


def test_health_endpoints(client: TestClient) -> None:
    live = client.get("/api/v1/health/live")
    assert live.status_code == 200
    ready = client.get("/api/v1/health/ready")
    assert ready.status_code == 200
    body = ready.json()
    assert body["status"] in {"ok", "degraded"}
    assert "ocr" in body["checks"]
    assert "storage" in body["checks"]
    assert len(ready.headers["x-request-id"]) == 32

    metrics = client.get("/metrics")
    assert metrics.status_code == 200
    assert metrics.headers["content-type"].startswith("text/plain")
    assert "ghost_reader_app_info" in metrics.text
    assert "ghost_reader_http_requests_total" in metrics.text
    assert 'route="/health/ready"' in metrics.text


def test_invalid_and_blocked_urls(client: TestClient) -> None:
    scheme = client.post("/api/v1/analyze", json={"url": "ftp://news-site.com/story"})
    assert scheme.status_code == 400
    assert scheme.json()["detail"]["code"] == "UNSUPPORTED_SCHEME"

    private = client.post("/api/v1/analyze", json={"url": "http://127.0.0.1/admin"})
    assert private.status_code == 400
    assert private.json()["detail"]["code"] == "BLOCKED_TARGET"


def test_analysis_job_lifecycle(client: TestClient) -> None:
    _prepare_resolver(client)
    services = client.app.state.services

    async def fake_analyze(url, *, prefer_browser=False, on_stage=None):  # type: ignore[no-untyped-def]
        if on_stage:
            await on_stage("Testing the analysis pipeline", 0.5)
        return _fake_analysis(url)

    services.analyzer.analyze = fake_analyze  # type: ignore[method-assign]

    created = client.post("/api/v1/analyze", json={"url": "https://news-site.com/story"})
    assert created.status_code == 202, created.text
    job_id = created.json()["job_id"]
    assert created.json()["status"] in {"QUEUED", "PROCESSING"}

    job = _poll(client, f"/api/v1/jobs/{job_id}")
    assert job["status"] == "SUCCEEDED"
    assert job["result"]["access_status"] == "PUBLIC_FULL"
    assert job["result"]["title"] == "Test article"

    deleted = client.delete(f"/api/v1/jobs/{job_id}")
    assert deleted.status_code == 200
    assert deleted.json() == {"deleted": True}
    missing = client.get(f"/api/v1/jobs/{job_id}")
    assert missing.status_code == 404
    assert missing.json()["detail"]["code"] == "JOB_NOT_FOUND"


def test_missing_job(client: TestClient) -> None:
    response = client.get("/api/v1/jobs/does-not-exist")
    assert response.status_code == 404


def test_document_upload_and_file_delivery(client: TestClient, tmp_path: Path) -> None:
    document = pymupdf.open()
    page = document.new_page()
    page.insert_text(
        (72, 72),
        "A synthetic PDF used by the Ghost Reader API tests. This text layer is embedded.",
        fontsize=11,
    )
    pdf_bytes = document.tobytes()
    document.close()

    response = client.post(
        "/api/v1/documents",
        files={"file": ("sample.pdf", pdf_bytes, "application/pdf")},
        data={"ocr_languages": "eng+kan"},
    )
    assert response.status_code == 202, response.text
    job_id = response.json()["job_id"]
    job = _poll(client, f"/api/v1/documents/{job_id}")
    assert job["status"] == "SUCCEEDED", job
    result = job["result"]
    assert result["document_kind"] == "PDF_DOCUMENT"
    assert result["page_count"] == 1
    assert result["requested_ocr_languages"] == ["eng", "kan"]
    assert "synthetic PDF" in result["pages"][0]["text"]

    file_response = client.get(f"/api/v1/documents/{job_id}/file")
    assert file_response.status_code == 200
    assert file_response.headers["content-type"].startswith("application/pdf")
    assert file_response.content.startswith(b"%PDF-")

    deleted = client.delete(f"/api/v1/jobs/{job_id}")
    assert deleted.status_code == 200
    file_after_delete = client.get(f"/api/v1/documents/{job_id}/file")
    assert file_after_delete.status_code == 404


def test_upload_rejects_fake_file(client: TestClient) -> None:
    response = client.post(
        "/api/v1/documents",
        files={"file": ("notes.txt", b"hello world", "text/plain")},
    )
    assert response.status_code == 415
    assert response.json()["detail"]["code"] == "UNSUPPORTED_FILE_TYPE"


def test_image_proxy_signature_and_delivery(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    services = client.app.state.services
    signed_path = services.signer.sign_path("https://cdn.news-site.com/image.png")

    tampered = client.get(signed_path.replace("sig=", "sig=0"))
    assert tampered.status_code == 403

    expired_path = services.signer.sign_path("https://cdn.news-site.com/image.png", ttl=-5)
    expired = client.get(expired_path)
    assert expired.status_code == 403

    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), (200, 170, 90)).save(buffer, format="PNG")
    png_bytes = buffer.getvalue()

    async def fake_fetch(url: str) -> tuple[bytes, str]:
        return png_bytes, "image/png"

    monkeypatch.setattr(services.image_proxy, "fetch", fake_fetch)
    response = client.get(signed_path)
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.content == png_bytes


def test_security_lab_endpoints(client: TestClient) -> None:
    scenarios = client.get("/api/v1/security-lab/scenarios")
    assert scenarios.status_code == 200
    ids = [item["id"] for item in scenarios.json()]
    assert len(ids) == 5
    assert "client-side-restriction" in ids

    for scenario_id in ids:
        run = client.post(f"/api/v1/security-lab/scenarios/{scenario_id}/run")
        assert run.status_code == 200, run.text
        body = run.json()
        assert body["scenario_id"] == scenario_id
        assert body["observed"]
        assert "No third-party website was contacted" in body["safe_note"]

    missing = client.post("/api/v1/security-lab/scenarios/not-real/run")
    assert missing.status_code == 404


def test_request_metrics_use_route_templates(client: TestClient) -> None:
    missing = client.get("/api/v1/jobs/not-a-real-job")
    assert missing.status_code == 404
    assert len(missing.headers["x-request-id"]) == 32

    metrics = client.get("/metrics").text
    assert 'route="/jobs/{job_id}"' in metrics
    assert 'route="/jobs/not-a-real-job"' not in metrics
