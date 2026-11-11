import asyncio
import io

import pytest
from PIL import Image, features

from app.services.image_proxy import ImageProxy
from app.services.safe_fetcher import FetchResult


class StubFetcher:
    def __init__(self, content: bytes, content_type: str) -> None:
        self.content = content
        self.content_type = content_type
        self.requested_accept: str | None = None

    async def fetch(self, url: str, **kwargs):  # type: ignore[no-untyped-def]
        self.requested_accept = kwargs["extra_headers"]["Accept"]
        return FetchResult(
            requested_url=url,
            final_url=url,
            status_code=200,
            headers={"content-type": self.content_type},
            content=self.content,
            content_type=self.content_type,
            charset=None,
            size_bytes=len(self.content),
            elapsed_ms=1,
        )


def test_image_proxy_delivers_avif(settings) -> None:  # type: ignore[no-untyped-def]
    if not features.check("avif"):
        pytest.skip("Pillow was built without AVIF support")

    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), (200, 170, 90)).save(buffer, format="AVIF")
    avif_bytes = buffer.getvalue()
    fetcher = StubFetcher(avif_bytes, "image/avif")

    content, mime = asyncio.run(ImageProxy(settings, fetcher).fetch("https://cdn.example.com/page.avif"))

    assert content == avif_bytes
    assert mime == "image/avif"
    assert fetcher.requested_accept is not None
    assert "image/avif" in fetcher.requested_accept
