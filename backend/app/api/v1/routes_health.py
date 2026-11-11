from __future__ import annotations

import asyncio
import os
import tempfile
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.api.deps import get_services
from app.schemas.jobs import HealthCheckReport

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
async def live(request: Request) -> dict[str, str]:
    services = get_services(request)
    return {
        "status": "ok",
        "service": services.settings.app_name,
        "version": services.settings.app_version,
    }


def _storage_check(directory: str) -> tuple[bool, str]:
    try:
        fd, path = tempfile.mkstemp(prefix=".health-", dir=directory)
        os.close(fd)
        os.unlink(path)
        return True, "Temporary storage is writable."
    except OSError as exc:
        return False, f"Temporary storage is not writable: {exc}"


@router.get("/ready")
async def ready(request: Request) -> JSONResponse:
    services = get_services(request)
    checks: dict[str, Any] = {}

    storage_ok, storage_message = _storage_check(str(services.settings.storage_path))
    checks["storage"] = {"ok": storage_ok, "message": storage_message}

    ocr_status = await asyncio.to_thread(services.ocr.status_summary)
    checks["ocr"] = {
        "ok": bool(ocr_status.get("available")),
        "english_available": bool(ocr_status.get("english_available")),
        "kannada_available": bool(ocr_status.get("kannada_available")),
        "languages": ocr_status.get("languages") or [],
        "version": ocr_status.get("version"),
        "message": ocr_status.get("error") if not ocr_status.get("available") else None,
    }

    store_backend = services.store.backend_name
    checks["job_store"] = {"ok": True, "backend": store_backend}
    client = getattr(services.store, "client", None)
    if client is not None:
        try:
            await client.ping()
            checks["job_store"]["message"] = "Redis connection is healthy."
        except Exception as exc:
            checks["job_store"] = {"ok": False, "backend": store_backend, "message": str(exc)}

    checks["browser_fallback"] = {
        "ok": True,
        "enabled": services.settings.enable_browser_fallback,
        "playwright_available": services.analyzer.renderer.package_available(),
    }

    status = "ok"
    if not storage_ok or not checks["job_store"]["ok"]:
        status = "unavailable"
    elif not ocr_status.get("available") or not ocr_status.get("kannada_available"):
        status = "degraded"

    report = HealthCheckReport(
        status=status,
        version=services.settings.app_version,
        environment=services.settings.environment,
        checks=checks,
    )
    return JSONResponse(
        status_code=503 if status == "unavailable" else 200,
        content=report.model_dump(mode="json"),
    )
