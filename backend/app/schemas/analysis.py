from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.enums import AccessStatus, BlockType, Confidence, PageType


class AccessAssessment(BaseModel):
    status: AccessStatus
    confidence: Confidence
    explanation: str
    evidence: list[str] = Field(default_factory=list)


class ImageReference(BaseModel):
    url: str
    proxy_url: str | None = None
    caption: str | None = None
    alt: str | None = None
    width: int | None = None
    height: int | None = None
    attribution: str | None = None


class NewspaperPage(BaseModel):
    page_number: int
    image_url: str
    proxy_url: str | None = None
    label: str | None = None
    alt: str | None = None


class ContentBlock(BaseModel):
    type: BlockType
    text: str | None = None
    level: int | None = None
    items: list[str] | None = None
    image_url: str | None = None
    proxy_url: str | None = None
    alt: str | None = None
    caption: str | None = None
    attribution: str | None = None


class AnalysisRequest(BaseModel):
    url: str = Field(min_length=4, max_length=4096)
    prefer_browser: bool = False


class AnalysisResult(BaseModel):
    source_url: str
    canonical_url: str | None = None
    publisher: str | None = None
    title: str | None = None
    subtitle: str | None = None
    author: str | None = None
    published_at: str | None = None
    updated_at: str | None = None
    description: str | None = None
    language: str | None = None
    content_type: PageType
    access_status: AccessStatus
    content: list[ContentBlock] = Field(default_factory=list)
    images: list[ImageReference] = Field(default_factory=list)
    newspaper_pages: list[NewspaperPage] = Field(default_factory=list)
    source_metadata: dict[str, Any] = Field(default_factory=dict)
    access_assessment: AccessAssessment
    word_count: int = 0
    reading_time_minutes: int = 0
    fetched_via: Literal["http", "browser", "none"] = "http"
    extractor: str | None = None
    notes: list[str] = Field(default_factory=list)
