from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.deps import get_services
from app.core.errors import NotFoundError
from app.schemas.jobs import AnalysisJobResponse

router = APIRouter(tags=["jobs"])


@router.get("/jobs/{job_id}", response_model=AnalysisJobResponse)
async def get_job(job_id: str, request: Request) -> AnalysisJobResponse:
    services = get_services(request)
    return await services.jobs.get_analysis_job(job_id)


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, request: Request) -> dict[str, bool]:
    services = get_services(request)
    deleted = await services.jobs.delete_job(job_id)
    if not deleted:
        raise NotFoundError("This job was not found or has already expired.", code="JOB_NOT_FOUND")
    return {"deleted": True}
