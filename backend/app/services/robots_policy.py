from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from urllib.robotparser import RobotFileParser

from app.core.config import Settings
from app.core.errors import AppError
from app.services.safe_fetcher import SafeFetcher
from app.services.url_validator import ValidatedURL

logger = logging.getLogger(__name__)

_UA_TOKEN = "GhostReader"


@dataclass
class RobotsDecision:
    allowed: bool
    reason: str


@dataclass
class _RobotsEntry:
    expires: float
    mode: str  # "rules", "allow_all", "deny_all"
    reason: str
    body: str = ""


class RobotsPolicy:
    """Best-effort robots.txt policy check for user-requested page retrieval.

    The parsed rules are cached per origin. Path decisions are evaluated on
    every request so different paths are not conflated.
    """

    def __init__(self, settings: Settings, fetcher: SafeFetcher) -> None:
        self.settings = settings
        self.fetcher = fetcher
        self._cache: dict[str, _RobotsEntry] = {}
        self._lock = asyncio.Lock()
        self._cache_seconds = 3600

    async def allowed(self, validated: ValidatedURL) -> RobotsDecision:
        if not self.settings.respect_robots_txt:
            return RobotsDecision(True, "robots.txt checks are disabled in this environment.")

        origin = validated.origin
        async with self._lock:
            entry = self._cache.get(origin)
            if entry and entry.expires <= time.monotonic():
                self._cache.pop(origin, None)
                entry = None

        if entry is None:
            entry = await self._fetch_rules(validated)
            async with self._lock:
                self._cache[origin] = entry

        if entry.mode == "allow_all":
            return RobotsDecision(True, entry.reason)
        if entry.mode == "deny_all":
            return RobotsDecision(False, entry.reason)

        parser = RobotFileParser()
        parser.set_url(f"{origin}/robots.txt")
        parser.parse(entry.body.splitlines())
        path = validated.path or "/"
        if validated.query:
            path = f"{path}?{validated.query}"
        try:
            permitted = parser.can_fetch(_UA_TOKEN, path)
        except Exception:
            permitted = True
        if not permitted:
            return RobotsDecision(
                False,
                "The publisher's robots.txt disallows automated retrieval of this path for Ghost Reader.",
            )
        return RobotsDecision(True, entry.reason)

    async def _fetch_rules(self, validated: ValidatedURL) -> _RobotsEntry:
        expires = time.monotonic() + self._cache_seconds
        robots_url = f"{validated.origin}/robots.txt"
        try:
            response = await self.fetcher.fetch(
                robots_url,
                max_bytes=512_000,
                timeout=6.0,
                allowed_content_types=("text/plain", "text/html", "application/xhtml+xml"),
            )
        except AppError as exc:
            logger.info("robots.txt could not be fetched for %s: %s", validated.host, exc)
            return _RobotsEntry(
                expires=expires,
                mode="allow_all",
                reason=(
                    "The publisher's robots.txt could not be retrieved; a single user-requested public page was attempted."
                ),
            )

        if response.status_code in {401, 403}:
            return _RobotsEntry(
                expires=expires,
                mode="deny_all",
                reason="The publisher's robots.txt explicitly restricts automated retrieval (HTTP 401/403).",
            )
        if response.status_code >= 400:
            return _RobotsEntry(
                expires=expires,
                mode="allow_all",
                reason=f"The publisher's robots.txt was unavailable (HTTP {response.status_code}).",
            )

        try:
            body = response.content.decode(response.charset or "utf-8", errors="replace")
        except (LookupError, UnicodeError):
            body = response.content.decode("utf-8", errors="replace")
        return _RobotsEntry(
            expires=expires,
            mode="rules",
            reason="The publisher's robots.txt was retrieved and evaluated for this path.",
            body=body,
        )
