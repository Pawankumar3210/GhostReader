from __future__ import annotations

import socket
from urllib.parse import urlsplit

import pytest

from app.core.errors import BlockedTarget, InvalidURL
from app.services.url_validator import URLValidator, is_blocked_address
from tests.conftest import fake_resolver


def make_validator(mapping: dict[str, list[str]] | None = None) -> URLValidator:
    resolver = fake_resolver(mapping or {"public-site.com": ["93.184.216.34"]})
    return URLValidator(allowed_ports={80, 443}, resolver=resolver, resolution_timeout=1.0)


@pytest.mark.parametrize(
    "url",
    [
        "ftp://public-site.com/file",
        "file:///etc/passwd",
        "data:text/html,hello",
        "javascript:alert(1)",
    ],
)
async def test_rejects_unsafe_schemes(url: str) -> None:
    with pytest.raises(InvalidURL):
        await make_validator().validate(url)


@pytest.mark.parametrize(
    "url",
    [
        "https://user:pass@public-site.com/",
        "https://public-site.com:8443/",
        "http://localhost/",
        "http://intranet/",
        "http://service.local/",
        "http://127.0.0.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/",
    ],
)
async def test_rejects_credentials_ports_and_internal_hosts(url: str) -> None:
    with pytest.raises((InvalidURL, BlockedTarget)):
        await make_validator().validate(url)


async def test_blocks_private_dns_results() -> None:
    validator = make_validator({"private-site.com": ["10.0.0.4"]})
    with pytest.raises(BlockedTarget):
        await validator.validate("https://private-site.com/story")


async def test_blocks_if_any_resolved_address_is_private() -> None:
    validator = make_validator({"mixed-site.com": ["93.184.216.34", "192.168.0.2"]})
    with pytest.raises(BlockedTarget):
        await validator.validate("https://mixed-site.com/")


async def test_dns_failure_is_reported() -> None:
    validator = make_validator({})
    with pytest.raises(InvalidURL) as error:
        await validator.validate("https://missing-site.com/")
    assert error.value.code == "DNS_FAILURE"


async def test_normalises_url_and_removes_fragment() -> None:
    validator = make_validator()
    validated = await validator.validate("HTTPS://Public-Site.COM:443/a/b?x=1#section")
    assert validated.url == "https://public-site.com/a/b?x=1"
    assert validated.origin == "https://public-site.com"
    assert validated.host == "public-site.com"
    assert urlsplit(validated.url).fragment == ""


async def test_allows_public_http_and_https() -> None:
    validator = make_validator()
    http = await validator.validate("http://public-site.com/")
    https = await validator.validate("https://public-site.com/")
    assert http.port == 80
    assert https.port == 443


def test_blocked_address_helper() -> None:
    assert is_blocked_address("127.0.0.1")
    assert is_blocked_address("169.254.169.254")
    assert is_blocked_address("10.1.2.3")
    assert is_blocked_address("::1")
    assert is_blocked_address("::ffff:127.0.0.1")
    assert not is_blocked_address("93.184.216.34")
    assert not is_blocked_address("2606:2800:220:1:248:1893:25c8:1946")


async def test_resolver_errors_are_wrapped() -> None:
    async def broken_resolver(host: str, port: int) -> list[str]:
        raise socket.gaierror("boom")

    validator = URLValidator(allowed_ports={80, 443}, resolver=broken_resolver)
    with pytest.raises(InvalidURL):
        await validator.validate("https://public-site.com/")
