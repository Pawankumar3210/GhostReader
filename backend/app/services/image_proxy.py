from __future__ import annotations

import io
import logging

from PIL import Image, UnidentifiedImageError

from app.core.config import Settings
from app.core.errors import FetchError
from app.services.safe_fetcher import SafeFetcher

logger = logging.getLogger(__name__)

_ALLOWED_MIME = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
    "image/avif": "AVIF",
    "image/gif": "GIF",
}
_MIME_BY_FORMAT = {value: key for key, value in _ALLOWED_MIME.items()}


class ImageProxy:
    """Controlled image retrieval. Only signed URLs from analysis results are accepted."""

    def __init__(self, settings: Settings, fetcher: SafeFetcher) -> None:
        self.settings = settings
        self.fetcher = fetcher

    async def fetch(self, url: str) -> tuple[bytes, str]:
        response = await self.fetcher.fetch(
            url,
            max_bytes=self.settings.image_proxy_max_bytes,
            allowed_content_types=tuple(_ALLOWED_MIME),
            extra_headers={
                "Accept": "image/avif,image/webp,image/jpeg,image/png,image/gif;q=0.9",
            },
        )
        if response.status_code < 200 or response.status_code >= 300:
            raise FetchError(
                "The image could not be retrieved from the publisher.",
                code="IMAGE_FETCH_FAILED",
                status_code=502,
            )
        if not response.content:
            raise FetchError("The publisher returned an empty image.", code="EMPTY_IMAGE")

        try:
            with Image.open(io.BytesIO(response.content)) as image:
                image_format = (image.format or "").upper()
                width, height = image.size
                if image_format not in _MIME_BY_FORMAT:
                    raise FetchError(
                        "The image format is not permitted.",
                        code="UNSUPPORTED_IMAGE_TYPE",
                        status_code=415,
                    )
                if width * height > self.settings.max_image_pixels:
                    raise FetchError(
                        "The image dimensions exceed the safe display limit.",
                        code="IMAGE_TOO_LARGE",
                        status_code=413,
                    )
                image.verify()
        except FetchError:
            raise
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise FetchError(
                "The publisher did not return a valid image.",
                code="INVALID_IMAGE",
                status_code=415,
            ) from exc

        mime = _MIME_BY_FORMAT.get(image_format)
        if not mime:
            raise FetchError(
                "The image format is not permitted.", code="UNSUPPORTED_IMAGE_TYPE", status_code=415
            )
        if response.content_type in _ALLOWED_MIME and response.content_type != mime:
            # Trust the verified binary format over a mismatched declaration.
            logger.info(
                "Image content-type mismatch (%s vs %s); using verified format.",
                response.content_type,
                mime,
            )
        return response.content, mime
