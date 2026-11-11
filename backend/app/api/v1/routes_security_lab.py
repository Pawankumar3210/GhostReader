from __future__ import annotations

import asyncio

from fastapi import APIRouter, Request

from app.api.deps import get_services
from app.core.errors import NotFoundError
from app.schemas.security_lab import ScenarioInfo, ScenarioRunResult

router = APIRouter(prefix="/security-lab", tags=["security-lab"])


@router.get("/scenarios", response_model=list[ScenarioInfo])
async def list_scenarios(request: Request) -> list[ScenarioInfo]:
    services = get_services(request)
    return services.lab.scenarios()


@router.post("/scenarios/{scenario_id}/run", response_model=ScenarioRunResult)
async def run_scenario(scenario_id: str, request: Request) -> ScenarioRunResult:
    services = get_services(request)
    try:
        return await asyncio.to_thread(services.lab.run, scenario_id)
    except KeyError as exc:
        raise NotFoundError("This security lab scenario does not exist.", code="SCENARIO_NOT_FOUND") from exc
