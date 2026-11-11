from __future__ import annotations

from fastapi import APIRouter, Request, status

from app.api.deps import get_services
from app.schemas.analysis import AnalysisRequest
from app.schemas.jobs import AnalysisJobResponse

router = APIRouter(tags=["analysis"])


@router.post(
    "/analyze",
    response_model=AnalysisJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def analyze_url(payload: AnalysisRequest, request: Request) -> AnalysisJobResponse:
    services = get_services(request)
    return await services.jobs.create_analysis_job(payload.url, prefer_browser=payload.prefer_browser)
