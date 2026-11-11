from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.analysis import AnalysisResult
from app.schemas.documents import DocumentResult
from app.schemas.enums import JobStatus


class JobError(BaseModel):
    code: str
    message: str


class JobRecord(BaseModel):
    job_id: str
    kind: Literal["analysis", "document"]
    status: JobStatus = JobStatus.QUEUED
    stage: str = "Queued"
    progress: float | None = None
    result: dict[str, Any] | None = None
    error: JobError | None = None
    created_at: datetime
    updated_at: datetime
    expires_at: datetime
    cancel_requested: bool = False
    meta: dict[str, Any] = Field(default_factory=dict)


class AnalysisJobResponse(BaseModel):
    job_id: str
    kind: Literal["analysis"] = "analysis"
    status: JobStatus
    stage: str
    progress: float | None = None
    result: AnalysisResult | None = None
    error: JobError | None = None
    created_at: datetime
    updated_at: datetime
    expires_at: datetime


class DocumentJobResponse(BaseModel):
    job_id: str
    kind: Literal["document"] = "document"
    status: JobStatus
    stage: str
    progress: float | None = None
    result: DocumentResult | None = None
    error: JobError | None = None
    created_at: datetime
    updated_at: datetime
    expires_at: datetime


class HealthCheckReport(BaseModel):
    status: Literal["ok", "degraded", "unavailable"]
    version: str
    environment: str
    checks: dict[str, Any]
