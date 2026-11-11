from __future__ import annotations

from pydantic import BaseModel, Field


class ScenarioInfo(BaseModel):
    id: str
    title: str
    category: str
    summary: str
    expected_result: str
    security_implications: list[str] = Field(default_factory=list)
    mitigation: list[str] = Field(default_factory=list)


class ScenarioRunResult(BaseModel):
    scenario_id: str
    title: str
    expected: str
    observed: str
    evidence: list[str] = Field(default_factory=list)
    explanation: str
    security_implications: list[str] = Field(default_factory=list)
    mitigation: list[str] = Field(default_factory=list)
    simulated_status: int | None = None
    duration_ms: int = 0
    safe_note: str = (
        "This scenario runs entirely against local synthetic fixtures. No third-party website was contacted."
    )
