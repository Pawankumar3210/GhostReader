from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.enums import DocumentKind


class DocumentPage(BaseModel):
    page_number: int
    width: float | None = None
    height: float | None = None
    has_text_layer: bool = False
    text: str = ""
    ocr_used: bool = False
    ocr_confidence: float | None = None
    ocr_language: str | None = None
    warnings: list[str] = Field(default_factory=list)


class DocumentResult(BaseModel):
    file_name: str
    document_kind: DocumentKind
    mime_type: str
    size_bytes: int
    page_count: int
    pages: list[DocumentPage] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    requested_ocr_languages: list[str] = Field(default_factory=list)
    used_ocr_languages: list[str] = Field(default_factory=list)
    ocr_available: bool = False
    diagnostics: list[str] = Field(default_factory=list)
    processing_notes: list[str] = Field(default_factory=list)
