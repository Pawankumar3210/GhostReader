from __future__ import annotations

from fastapi import APIRouter, Query, Request, Response

from app.api.deps import get_services
from app.core.errors import AppError

router = APIRouter(tags=["images"])


@router.get("/images")
async def proxy_image(
    request: Request,
    url: str = Query(min_length=8, max_length=4096),
    exp: int = Query(...),
    sig: str = Query(min_length=16, max_length=128),
) -> Response:
    services = get_services(request)
    if not services.signer.verify(url, exp, sig):
        raise AppError(
            "This image link is invalid or has expired.",
            code="INVALID_IMAGE_SIGNATURE",
            status_code=403,
        )
    content, mime = await services.image_proxy.fetch(url)
    return Response(
        content=content,
        media_type=mime,
        headers={
            "Cache-Control": "private, max-age=3600",
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
        },
    )
