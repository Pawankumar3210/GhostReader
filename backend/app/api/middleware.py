from __future__ import annotations

import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.api.metrics import RATE_LIMIT_REJECTIONS
from app.core.config import Settings


class SlidingWindowRateLimiter:
    def __init__(self, window_seconds: int = 60) -> None:
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._last_cleanup = time.monotonic()

    def allow(self, key: str, limit: int) -> tuple[bool, int]:
        now = time.monotonic()
        if now - self._last_cleanup > 120:
            self._cleanup(now)
        window_start = now - self.window_seconds
        hits = [stamp for stamp in self._hits.get(key, []) if stamp >= window_start]
        self._hits[key] = hits
        if len(hits) >= limit:
            retry_after = max(1, int(self.window_seconds - (now - hits[0])))
            return False, retry_after
        hits.append(now)
        return True, 0

    def _cleanup(self, now: float) -> None:
        window_start = now - self.window_seconds
        for key in list(self._hits):
            self._hits[key] = [stamp for stamp in self._hits[key] if stamp >= window_start]
            if not self._hits[key]:
                self._hits.pop(key, None)
        self._last_cleanup = now


def client_identity(request: Request, settings: Settings) -> str:
    if settings.trust_forwarded_for:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings) -> None:
        super().__init__(app)
        self.settings = settings
        self.limiter = SlidingWindowRateLimiter()

    def _limits_for(self, request: Request) -> tuple[str, int] | None:
        path = request.url.path
        method = request.method.upper()
        api_prefix = self.settings.api_prefix
        if not path.startswith(api_prefix):
            return None
        if path.startswith(f"{api_prefix}/images"):
            return "images", self.settings.rate_limit_per_minute * 6
        if method == "POST" and path.rstrip("/") == f"{api_prefix}/analyze":
            return "analyze", self.settings.analyze_rate_limit_per_minute
        if method == "POST" and path.rstrip("/") == f"{api_prefix}/documents":
            return "documents", self.settings.upload_rate_limit_per_minute
        if method == "POST" and "/security-lab/" in path:
            return "lab", self.settings.analyze_rate_limit_per_minute
        if method in {"POST", "DELETE", "PUT", "PATCH"}:
            return "mutations", self.settings.rate_limit_per_minute
        return None

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        if request.method == "OPTIONS":
            return await call_next(request)
        limits = self._limits_for(request)
        if limits is not None:
            group, limit = limits
            key = f"{group}:{client_identity(request, self.settings)}"
            allowed, retry_after = self.limiter.allow(key, limit)
            if not allowed:
                RATE_LIMIT_REJECTIONS.labels(group).inc()
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": {
                            "code": "RATE_LIMITED",
                            "message": "Too many requests. Please wait a moment and try again.",
                        }
                    },
                    headers={"Retry-After": str(retry_after)},
                )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings) -> None:
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        if request.method in {"POST", "PUT", "PATCH"}:
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    length = int(content_length)
                except ValueError:
                    length = 0
                upload_path = request.url.path.rstrip("/").endswith("/documents")
                limit = (
                    self.settings.max_upload_bytes + 2_000_000
                    if upload_path
                    else self.settings.max_json_body_bytes
                )
                if length > limit:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "detail": {
                                "code": "REQUEST_TOO_LARGE",
                                "message": "The request body exceeds the permitted size limit.",
                            }
                        },
                    )
        return await call_next(request)
