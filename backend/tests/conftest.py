from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

TEST_STORAGE = tempfile.mkdtemp(prefix="ghost-reader-tests-")
os.environ.setdefault("GR_STORAGE_DIR", TEST_STORAGE)
os.environ.setdefault("GR_RESPECT_ROBOTS_TXT", "false")
os.environ.setdefault("GR_ENABLE_BROWSER_FALLBACK", "false")

from app.core.config import Settings  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


def make_settings(tmp_path: Path, **overrides) -> Settings:  # type: ignore[no-untyped-def]
    values = {
        "storage_dir": str(tmp_path / "storage"),
        "redis_url": None,
        "use_worker_queue": False,
        "respect_robots_txt": False,
        "enable_browser_fallback": False,
        "request_timeout_seconds": 5.0,
        "connect_timeout_seconds": 2.0,
        "max_response_bytes": 1_000_000,
        "max_upload_bytes": 10_000_000,
        "max_pdf_pages": 20,
        "max_image_pixels": 20_000_000,
        "ocr_languages": "eng+kan",
        "rate_limit_per_minute": 1000,
        "analyze_rate_limit_per_minute": 1000,
        "upload_rate_limit_per_minute": 1000,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return make_settings(tmp_path)


def load_fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def fake_resolver(mapping: dict[str, list[str]]):
    import socket

    async def resolver(host: str, port: int) -> list[str]:
        if host in mapping:
            return mapping[host]
        raise socket.gaierror(f"no test mapping for {host}")

    return resolver


@pytest.fixture
def public_resolver():
    return fake_resolver(
        {
            "news-site.com": ["93.184.216.34"],
            "blog-site.com": ["93.184.216.34"],
            "allowed.com": ["93.184.216.34"],
            "private.com": ["10.1.2.3"],
            "mixed.com": ["93.184.216.34", "192.168.1.5"],
        }
    )
