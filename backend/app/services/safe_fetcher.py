from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import dataclass, field
from urllib.parse import urljoin

import httpx

from app.core.config import Settings
from app.core.errors import BlockedTarget, FetchError, InvalidURL
from app.services.url_validator import URLValidator, ValidatedURL

logger = logging.getLogger(__name__)

_REDIRECT_CODES = {301, 302, 303, 307, 308}
_CHARSET_RE = re.compile(r"charset\s*=\s*[\"']?([A-Za-z0-9._-]+)", re.IGNORECASE)


@dataclass
class FetchResult:
    requested_url: str
    final_url: str
    status_code: int
    headers: dict[str, str]
    content: bytes
    content_type: str
    charset: str | None
    size_bytes: int
    redirects: list[str] = field(default_factory=list)
    elapsed_ms: int = 0


class SafeFetcher:
    """HTTP client hardened against SSRF, oversized responses and open redirects.

    Redirects are followed manually so that every hop is revalidated. DNS is
    resolved immediately before each hop. For production deployments the
    backend should additionally run behind an egress firewall or proxy, which
    closes the residual DNS-rebinding window between resolution and connection.
    """

    def __init__(
        self,
        settings: Settings,
        validator: URLValidator,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.settings = settings
        self.validator = validator
        self._transport = transport

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {
            "User-Agent": self.settings.user_agent,
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;q=0.9,"
                "application/pdf;q=0.8,image/avif,image/webp,image/png,image/jpeg;q=0.7,*/*;q=0.5"
            ),
            "Accept-Language": "en,kn;q=0.8",
            "Accept-Encoding": "gzip, deflate",
            "Cache-Control": "no-cache",
            "DNT": "1",
        }
        if extra:
            headers.update(extra)
        return headers

    @staticmethod
    def _parse_content_type(value: str | None) -> tuple[str, str | None]:
        if not value:
            return "", None
        main = value.split(";", 1)[0].strip().lower()
        match = _CHARSET_RE.search(value)
        charset = match.group(1).strip() if match else None
        return main, charset

    async def fetch(
        self,
        url: str,
        *,
        max_bytes: int | None = None,
        allowed_content_types: tuple[str, ...] | None = None,
        timeout: float | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> FetchResult:
        max_bytes = max_bytes or self.settings.max_response_bytes
        overall_timeout = timeout or self.settings.request_timeout_seconds
        started = time.monotonic()

        try:
            async with asyncio.timeout(overall_timeout):
                return await self._fetch_once_loop(
                    url,
                    max_bytes=max_bytes,
                    allowed_content_types=allowed_content_types,
                    extra_headers=extra_headers,
                    started=started,
                )
        except TimeoutError as exc:
            raise FetchError(
                "The page took too long to respond.",
                code="FETCH_TIMEOUT",
                status_code=504,
            ) from exc

    async def _fetch_once_loop(
        self,
        url: str,
        *,
        max_bytes: int,
        allowed_content_types: tuple[str, ...] | None,
        extra_headers: dict[str, str] | None,
        started: float,
    ) -> FetchResult:
        timeout = httpx.Timeout(
            connect=self.settings.connect_timeout_seconds,
            read=self.settings.request_timeout_seconds,
            write=self.settings.request_timeout_seconds,
            pool=self.settings.connect_timeout_seconds,
        )
        client_kwargs: dict[str, object] = {
            "timeout": timeout,
            "follow_redirects": False,
            "headers": self._headers(extra_headers),
            "http2": False,
        }
        if self._transport is not None:
            client_kwargs["transport"] = self._transport

        current_url = url
        redirects: list[str] = []
        visited: set[str] = set()

        async with httpx.AsyncClient(**client_kwargs) as client:  # type: ignore[arg-type]
            for _hop in range(self.settings.max_redirects + 1):
                if current_url in visited:
                    raise FetchError("The page redirects in a loop.", code="REDIRECT_LOOP", status_code=502)
                visited.add(current_url)

                parsed = self.validator.parse(current_url)
                validated: ValidatedURL = await self.validator.resolve(parsed)
                request = client.build_request("GET", validated.url)

                try:
                    response = await client.send(request, stream=True)
                except httpx.TimeoutException as exc:
                    raise FetchError(
                        "The page took too long to respond.",
                        code="FETCH_TIMEOUT",
                        status_code=504,
                    ) from exc
                except httpx.ConnectError as exc:
                    raise FetchError(
                        "A secure connection to the publisher could not be established.",
                        code="CONNECTION_FAILED",
                        status_code=502,
                    ) from exc
                except httpx.HTTPError as exc:
                    raise FetchError(
                        "The page could not be retrieved.",
                        code="FETCH_FAILED",
                        status_code=502,
                    ) from exc

                try:
                    if response.status_code in _REDIRECT_CODES:
                        location = response.headers.get("location")
                        await response.aclose()
                        if not location:
                            raise FetchError(
                                "The publisher returned an invalid redirect.",
                                code="INVALID_REDIRECT",
                                status_code=502,
                            )
                        next_url = urljoin(validated.url, location)
                        if validated.scheme == "https" and next_url.lower().startswith("http://"):
                            raise BlockedTarget(
                                "The page attempted to downgrade from HTTPS to HTTP, which is blocked."
                            )
                        current_url = next_url
                        redirects.append(next_url)
                        continue

                    length_header = response.headers.get("content-length")
                    if length_header:
                        try:
                            if int(length_header) > max_bytes:
                                await response.aclose()
                                raise FetchError(
                                    "The response is larger than the permitted limit.",
                                    code="RESPONSE_TOO_LARGE",
                                    status_code=413,
                                )
                        except ValueError:
                            pass

                    content_type, charset = self._parse_content_type(response.headers.get("content-type"))
                    if (
                        allowed_content_types
                        and content_type
                        and not any(
                            content_type == allowed or content_type.startswith(allowed + "+")
                            for allowed in allowed_content_types
                        )
                    ):
                        await response.aclose()
                        raise FetchError(
                            f"The server returned an unsupported content type ({content_type}).",
                            code="UNSUPPORTED_CONTENT_TYPE",
                            status_code=415,
                        )

                    buffer = bytearray()
                    try:
                        async for chunk in response.aiter_bytes():
                            if len(buffer) + len(chunk) > max_bytes:
                                raise FetchError(
                                    "The response is larger than the permitted limit.",
                                    code="RESPONSE_TOO_LARGE",
                                    status_code=413,
                                )
                            buffer.extend(chunk)
                    finally:
                        await response.aclose()

                    return FetchResult(
                        requested_url=url,
                        final_url=str(response.url),
                        status_code=response.status_code,
                        headers={k.lower(): v for k, v in response.headers.items()},
                        content=bytes(buffer),
                        content_type=content_type,
                        charset=charset,
                        size_bytes=len(buffer),
                        redirects=redirects,
                        elapsed_ms=int((time.monotonic() - started) * 1000),
                    )
                except (FetchError, BlockedTarget, InvalidURL):
                    raise
                except asyncio.CancelledError:
                    await response.aclose()
                    raise
                except Exception as exc:  # pragma: no cover - defensive network path
                    await response.aclose()
                    raise FetchError(
                        "The page could not be retrieved safely.",
                        code="FETCH_FAILED",
                        status_code=502,
                    ) from exc

        raise FetchError(
            "The page redirected too many times.",
            code="TOO_MANY_REDIRECTS",
            status_code=502,
        )
