from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    routes_analyze,
    routes_documents,
    routes_health,
    routes_images,
    routes_jobs,
    routes_security_lab,
)

api_router = APIRouter()
api_router.include_router(routes_health.router)
api_router.include_router(routes_analyze.router)
api_router.include_router(routes_jobs.router)
api_router.include_router(routes_documents.router)
api_router.include_router(routes_images.router)
api_router.include_router(routes_security_lab.router)
