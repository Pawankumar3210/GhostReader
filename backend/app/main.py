from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.api.deps import build_services
from app.api.metrics import APP_INFO
from app.api.middleware import BodySizeLimitMiddleware, RateLimitMiddleware, SecurityHeadersMiddleware
from app.api.observability import ObservabilityMiddleware
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import AppError

settings = get_settings()
APP_INFO.labels(version=settings.app_version, environment=settings.environment).set(1)
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("ghost-reader")


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[no-untyped-def]
    services = await build_services(settings)
    app.state.services = services

    async def cleanup_loop() -> None:
        while True:
            try:
                await asyncio.sleep(settings.cleanup_interval_seconds)
                await services.jobs.cleanup()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Temporary-data cleanup failed")

    cleanup_task = asyncio.create_task(cleanup_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        with suppress(asyncio.CancelledError):
            await cleanup_task
        await services.jobs.close()
        logger.info("Ghost Reader services shut down.")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Ghost Reader transforms publicly accessible pages and authorised documents into a clean reading "
        "experience. It respects publisher access controls and never bypasses authentication."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(RateLimitMiddleware, settings=settings)
app.add_middleware(BodySizeLimitMiddleware, settings=settings)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
    expose_headers=["Content-Disposition", "Retry-After", "X-Request-ID"],
    max_age=600,
)
app.add_middleware(ObservabilityMiddleware, settings=settings)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    if exc.status_code >= 500:
        logger.error("Application error on %s: %s", request.url.path, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": {
                "code": exc.code,
                "message": exc.message,
                "context": exc.context or None,
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    location = ".".join(str(part) for part in first.get("loc", []) if part not in {"body", "query"})
    message = first.get("msg", "The request contains invalid data.")
    if location:
        message = f"{location}: {message}"
    return JSONResponse(
        status_code=422,
        content={"detail": {"code": "VALIDATION_ERROR", "message": message}},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "code": "INTERNAL_ERROR",
                "message": "The request could not be completed because of an unexpected internal error.",
            }
        },
    )


app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/metrics", include_in_schema=False)
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "api": settings.api_prefix,
        "docs": "/docs",
        "tagline": "Beyond the Page. Into the Content.",
    }
