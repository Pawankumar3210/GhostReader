from __future__ import annotations

import importlib.util
import logging
from contextlib import suppress
from dataclasses import dataclass
from urllib.parse import urlsplit

from app.core.config import Settings
from app.services.url_validator import URLValidator

logger = logging.getLogger(__name__)


@dataclass
class RenderedPage:
    html: str
    final_url: str
    status_code: int | None = None


class BrowserRenderer:
    """Optional, isolated JavaScript rendering fallback.

    No stealth plugins, challenge solving or authentication is used. Every
    request made by the browser context, including subresources and frames, is
    checked against the same network-safety policy before it is allowed.
    """

    def __init__(self, settings: Settings, validator: URLValidator) -> None:
        self.settings = settings
        self.validator = validator

    @staticmethod
    def package_available() -> bool:
        return importlib.util.find_spec("playwright") is not None

    async def render(self, url: str) -> RenderedPage | None:
        if not self.settings.enable_browser_fallback:
            return None
        if not self.package_available():
            logger.info("Playwright is not installed; browser fallback is unavailable.")
            return None

        try:
            from playwright.async_api import async_playwright
        except Exception:  # pragma: no cover - optional dependency
            logger.warning("Playwright could not be imported.")
            return None

        import asyncio

        async def guard_route(route) -> None:  # type: ignore[no-untyped-def]
            request = route.request
            request_url = request.url
            parsed = urlsplit(request_url)
            if parsed.scheme not in {"http", "https"}:
                await route.abort()
                return
            if request.resource_type in {"media", "websocket", "manifest", "other"}:
                await route.abort()
                return
            try:
                await self.validator.validate(request_url)
            except Exception as exc:
                logger.info("Browser request blocked by policy: %s (%s)", request_url, exc)
                await route.abort()
                return
            try:
                await route.continue_()
            except Exception:  # pragma: no cover - request may be cancelled
                return

        try:
            async with async_playwright() as playwright:
                browser = await playwright.chromium.launch(headless=True)
                try:
                    context = await browser.new_context(
                        accept_downloads=False,
                        java_script_enabled=True,
                        ignore_https_errors=False,
                        locale="en-US",
                        user_agent=self.settings.user_agent,
                        viewport={"width": 1366, "height": 900},
                        service_workers="block",
                    )
                    await context.route("**/*", guard_route)
                    page = await context.new_page()
                    page.set_default_timeout(self.settings.browser_timeout_seconds * 1000)
                    page.set_default_navigation_timeout(self.settings.browser_timeout_seconds * 1000)
                    try:
                        response = await page.goto(
                            url,
                            wait_until="domcontentloaded",
                            timeout=self.settings.browser_timeout_seconds * 1000,
                        )
                        with suppress(Exception):
                            await page.wait_for_load_state(
                                "networkidle", timeout=min(8000, self.settings.browser_timeout_seconds * 1000)
                            )
                        await asyncio.sleep(0.6)
                        html = await page.content()
                        final_url = page.url
                        status_code = response.status if response else None
                        return RenderedPage(html=html, final_url=final_url, status_code=status_code)
                    finally:
                        await context.close()
                finally:
                    await browser.close()
        except Exception as exc:  # pragma: no cover - browser availability varies
            logger.warning("Browser fallback failed for %s: %s", url, exc)
            return None
