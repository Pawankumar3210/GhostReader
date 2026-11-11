from __future__ import annotations

from app.api.middleware import SlidingWindowRateLimiter
from app.core.config import Settings
from app.services.robots_policy import RobotsPolicy
from app.services.safe_fetcher import FetchResult
from app.services.url_validator import ValidatedURL


def validated(path: str) -> ValidatedURL:
    return ValidatedURL(
        original_url=f"https://news-site.com{path}",
        url=f"https://news-site.com{path}",
        scheme="https",
        host="news-site.com",
        port=443,
        path=path,
        query="",
        ip_addresses=("93.184.216.34",),
    )


class FakeFetcher:
    def __init__(self, body: bytes, status_code: int = 200) -> None:
        self.body = body
        self.status_code = status_code
        self.calls = 0

    async def fetch(self, url: str, **kwargs):  # type: ignore[no-untyped-def]
        self.calls += 1
        return FetchResult(
            requested_url=url,
            final_url=url,
            status_code=self.status_code,
            headers={"content-type": "text/plain"},
            content=self.body,
            content_type="text/plain",
            charset="utf-8",
            size_bytes=len(self.body),
        )


async def test_robots_disallow_and_allow(settings: Settings) -> None:
    enabled = settings.model_copy(update={"respect_robots_txt": True})
    fetcher = FakeFetcher(b"User-agent: *\nDisallow: /private\nAllow: /public\n")
    policy = RobotsPolicy(enabled, fetcher)  # type: ignore[arg-type]
    denied = await policy.allowed(validated("/private/story"))
    allowed = await policy.allowed(validated("/public/story"))
    assert denied.allowed is False
    assert "disallows" in denied.reason
    assert allowed.allowed is True


async def test_robots_403_disallows(settings: Settings) -> None:
    enabled = settings.model_copy(update={"respect_robots_txt": True})
    policy = RobotsPolicy(enabled, FakeFetcher(b"", status_code=403))  # type: ignore[arg-type]
    decision = await policy.allowed(validated("/story"))
    assert decision.allowed is False


async def test_robots_unavailable_allows_single_request(settings: Settings) -> None:
    enabled = settings.model_copy(update={"respect_robots_txt": True})
    policy = RobotsPolicy(enabled, FakeFetcher(b"", status_code=404))  # type: ignore[arg-type]
    decision = await policy.allowed(validated("/story"))
    assert decision.allowed is True


def test_rate_limiter() -> None:
    limiter = SlidingWindowRateLimiter(window_seconds=60)
    assert limiter.allow("ip:a", 2)[0] is True
    assert limiter.allow("ip:a", 2)[0] is True
    allowed, retry_after = limiter.allow("ip:a", 2)
    assert allowed is False
    assert retry_after >= 1
    assert limiter.allow("ip:b", 1)[0] is True
