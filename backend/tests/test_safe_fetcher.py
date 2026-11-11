from __future__ import annotations

import httpx
import pytest

from app.core.errors import BlockedTarget, FetchError
from app.services.safe_fetcher import SafeFetcher
from app.services.url_validator import URLValidator
from tests.conftest import fake_resolver


def build_fetcher(settings, handler, mapping=None) -> SafeFetcher:  # type: ignore[no-untyped-def]
    validator = URLValidator(
        allowed_ports={80, 443},
        resolver=fake_resolver(
            mapping
            or {
                "allowed.com": ["93.184.216.34"],
                "private.com": ["10.0.0.8"],
            }
        ),
        resolution_timeout=1.0,
    )
    transport = httpx.MockTransport(handler)
    return SafeFetcher(settings, validator, transport=transport)


async def test_successful_html_fetch(settings) -> None:  # type: ignore[no-untyped-def]
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"Content-Type": "text/html; charset=utf-8"},
            content=b"<html><title>Hello</title></html>",
        )

    fetcher = build_fetcher(settings, handler)
    result = await fetcher.fetch("https://allowed.com/article")
    assert result.status_code == 200
    assert result.content_type == "text/html"
    assert result.charset == "utf-8"
    assert b"Hello" in result.content


async def test_redirect_to_private_address_is_blocked(settings) -> None:  # type: ignore[no-untyped-def]
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "allowed.com":
            return httpx.Response(302, headers={"Location": "http://private.com/internal"})
        return httpx.Response(200, content=b"secret")

    fetcher = build_fetcher(settings, handler)
    with pytest.raises(BlockedTarget):
        await fetcher.fetch("https://allowed.com/redirect")


async def test_redirect_loop_is_rejected(settings) -> None:  # type: ignore[no-untyped-def]
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"Location": "https://allowed.com/loop"})

    fetcher = build_fetcher(settings, handler)
    with pytest.raises(FetchError):
        await fetcher.fetch("https://allowed.com/loop")


async def test_https_downgrade_is_blocked(settings) -> None:  # type: ignore[no-untyped-def]
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(301, headers={"Location": "http://allowed.com/insecure"})

    fetcher = build_fetcher(settings, handler)
    with pytest.raises(BlockedTarget):
        await fetcher.fetch("https://allowed.com/start")


async def test_response_size_limit(settings) -> None:  # type: ignore[no-untyped-def]
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"x" * 5000)

    fetcher = build_fetcher(settings, handler)
    with pytest.raises(FetchError) as error:
        await fetcher.fetch("https://allowed.com/large", max_bytes=1000)
    assert error.value.code == "RESPONSE_TOO_LARGE"


async def test_unsupported_content_type_rejected_when_restricted(settings) -> None:  # type: ignore[no-untyped-def]
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"Content-Type": "application/zip"}, content=b"PK")

    fetcher = build_fetcher(settings, handler)
    with pytest.raises(FetchError) as error:
        await fetcher.fetch("https://allowed.com/file", allowed_content_types=("text/html",))
    assert error.value.code == "UNSUPPORTED_CONTENT_TYPE"


async def test_http_error_status_is_returned_not_raised(settings) -> None:  # type: ignore[no-untyped-def]
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, headers={"Content-Type": "text/html"}, content=b"forbidden")

    fetcher = build_fetcher(settings, handler)
    result = await fetcher.fetch("https://allowed.com/blocked")
    assert result.status_code == 403
    assert result.content == b"forbidden"


async def test_redirect_chain_is_recorded(settings) -> None:  # type: ignore[no-untyped-def]
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/one":
            return httpx.Response(302, headers={"Location": "/two"})
        if request.url.path == "/two":
            return httpx.Response(302, headers={"Location": "/three"})
        return httpx.Response(200, headers={"Content-Type": "text/html"}, content=b"done")

    fetcher = build_fetcher(settings, handler)
    result = await fetcher.fetch("https://allowed.com/one")
    assert len(result.redirects) == 2
    assert result.final_url.endswith("/three")
