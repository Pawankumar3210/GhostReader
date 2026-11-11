from __future__ import annotations

import json
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.api.metrics import HTTP_DURATION, HTTP_REQUESTS
from app.api.middleware import client_identity
from app.core.config import Settings

logger = logging.getLogger("ghost-reader.access")

_SKIP_PATHS = {"/metrics", "/api/v1/health/live"}


def _route_label(request: Request) -> str:
    route = request.scope.get("route")
    path = getattr(route, "path", None)
    return str(path) if path else "unmatched"


class ObservabilityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings) -> None:
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        if request.url.path in _SKIP_PATHS:
            return await call_next(request)

        request_id = uuid.uuid4().hex
        request.state.request_id = request_id
        started = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            route = _route_label(request)
            elapsed = time.perf_counter() - started
            HTTP_REQUESTS.labels(request.method, route, "500").inc()
            HTTP_DURATION.labels(request.method, route).observe(elapsed)
            logger.exception(
                json.dumps(
                    {
                        "event": "http_request",
                        "request_id": request_id,
                        "method": request.method,
                        "path": request.url.path,
                        "status": 500,
                        "duration_ms": round(elapsed * 1000, 2),
                    },
                    separators=(",", ":"),
                )
            )
            raise

        elapsed = time.perf_counter() - started
        route = _route_label(request)
        HTTP_REQUESTS.labels(request.method, route, str(status_code)).inc()
        HTTP_DURATION.labels(request.method, route).observe(elapsed)
        logger.info(
            json.dumps(
                {
                    "event": "http_request",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": status_code,
                    "duration_ms": round(elapsed * 1000, 2),
                    "client": client_identity(request, self.settings),
                },
                separators=(",", ":"),
            )
        )
        response.headers["X-Request-ID"] = request_id
        return response
