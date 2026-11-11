from __future__ import annotations

import hashlib
import hmac
import time
from urllib.parse import quote, urlencode

from app.core.config import Settings


class URLSigner:
    """Signs image-proxy URLs so the proxy cannot be used as an open fetcher."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.secret = settings.secret_key.encode()

    def _signature(self, url: str, expires: int) -> str:
        message = f"{url}\n{expires}".encode()
        return hmac.new(self.secret, message, hashlib.sha256).hexdigest()

    def sign_path(self, url: str, *, ttl: int | None = None) -> str:
        expires = int(time.time()) + (ttl or self.settings.image_signature_ttl_seconds)
        signature = self._signature(url, expires)
        query = urlencode({"url": url, "exp": expires, "sig": signature}, quote_via=quote)
        return f"{self.settings.api_prefix}/images?{query}"

    def verify(self, url: str, expires: int, signature: str) -> bool:
        if expires < int(time.time()):
            return False
        expected = self._signature(url, expires)
        return hmac.compare_digest(expected, signature)
