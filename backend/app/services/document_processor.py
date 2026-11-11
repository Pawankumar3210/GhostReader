from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pymupdf
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import Settings
from app.core.errors import DocumentError
from app.schemas.documents import DocumentPage, DocumentResult
from app.schemas.enums import DocumentKind
from app.services.ocr_service import OcrService
from app.utils.files import mime_for_kind, sniff_content_kind
from app.utils.text import normalize_inline

logger = logging.getLogger(__name__)

StageCallback = Callable[[str, float | None], None]
CancelCheck = Callable[[], bool]

_ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}
_MAX_HEAD_BYTES = 4096


class ProcessingCancelled(Exception):
    pass


@dataclass
class InspectedDocument:
    file_path: Path
    file_name: str
    kind: DocumentKind
    mime_type: str
    size_bytes: int
    page_count: int
    metadata: dict[str, Any] = field(default_factory=dict)
    image_width: int | None = None
    image_height: int | None = None


def _clean_metadata_value(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _extract_pdf_sections(toc: list[Any]) -> list[str]:
    sections: list[str] = []
    for entry in toc:
        try:
            level, title = entry[0], entry[1]
        except (IndexError, TypeError):
            continue
        if level == 1 and title:
            cleaned = str(title).strip()
            if cleaned and cleaned not in sections:
                sections.append(cleaned)
    return sections[:20]


class DocumentProcessor:
    def __init__(self, settings: Settings, ocr: OcrService) -> None:
        self.settings = settings
        self.ocr = ocr

    def inspect(self, file_path: Path, file_name: str) -> InspectedDocument:
        size = file_path.stat().st_size
        if size == 0:
            raise DocumentError("The uploaded file is empty.", code="EMPTY_FILE")
        if size > self.settings.max_upload_bytes:
            raise DocumentError(
                "The uploaded file exceeds the configured size limit.",
                code="FILE_TOO_LARGE",
                status_code=413,
            )
        with file_path.open("rb") as handle:
            head = handle.read(_MAX_HEAD_BYTES)
        kind = sniff_content_kind(head, file_name)
        if kind is None:
            raise DocumentError(
                "The file signature is not a supported PDF, PNG, JPG or JPEG document.",
                code="UNSUPPORTED_FILE_TYPE",
                status_code=415,
            )

        if kind == "PDF_DOCUMENT":
            try:
                document = pymupdf.open(str(file_path))
            except Exception as exc:
                raise DocumentError(
                    "The PDF could not be opened. It may be corrupt or malformed.",
                    code="CORRUPT_PDF",
                ) from exc
            try:
                if document.needs_pass:
                    raise DocumentError(
                        "Password-protected PDFs are not supported. Please provide an unlocked document.",
                        code="PASSWORD_PROTECTED_PDF",
                    )
                page_count = document.page_count
                if page_count <= 0:
                    raise DocumentError("The PDF contains no pages.", code="EMPTY_PDF")
                if page_count > self.settings.max_pdf_pages:
                    raise DocumentError(
                        f"The PDF has {page_count} pages, which exceeds the configured limit of "
                        f"{self.settings.max_pdf_pages}.",
                        code="TOO_MANY_PAGES",
                        status_code=413,
                    )
                raw_metadata = document.metadata or {}
                metadata: dict[str, Any] = {}
                for key, value in raw_metadata.items():
                    cleaned = _clean_metadata_value(value)
                    if cleaned:
                        metadata[str(key)] = cleaned
                sections = _extract_pdf_sections(document.get_toc(simple=True))
                if sections:
                    metadata["sections"] = sections
                metadata["page_count"] = page_count
                return InspectedDocument(
                    file_path=file_path,
                    file_name=file_name,
                    kind=DocumentKind.PDF,
                    mime_type="application/pdf",
                    size_bytes=size,
                    page_count=page_count,
                    metadata=metadata,
                )
            finally:
                document.close()

        try:
            with Image.open(file_path) as image:
                image_format = (image.format or "").upper()
                if image_format not in _ALLOWED_IMAGE_FORMATS:
                    raise DocumentError(
                        f"Image format {image_format or 'unknown'} is not supported. Use PDF, PNG, JPG or JPEG.",
                        code="UNSUPPORTED_IMAGE_FORMAT",
                        status_code=415,
                    )
                width, height = image.size
                if width <= 0 or height <= 0:
                    raise DocumentError("The image has invalid dimensions.", code="INVALID_IMAGE")
                if width * height > self.settings.max_image_pixels:
                    raise DocumentError(
                        "The image dimensions exceed the safe processing limit.",
                        code="IMAGE_TOO_LARGE",
                        status_code=413,
                    )
                image.verify()
        except DocumentError:
            raise
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise DocumentError(
                "The image could not be read. It may be corrupt or not a genuine image file.",
                code="CORRUPT_IMAGE",
            ) from exc

        return InspectedDocument(
            file_path=file_path,
            file_name=file_name,
            kind=DocumentKind.IMAGE,
            mime_type=mime_for_kind("IMAGE_DOCUMENT", file_name),
            size_bytes=size,
            page_count=1,
            metadata={"format": image_format},
            image_width=width,
            image_height=height,
        )

    def _normalize_image(self, path: Path) -> tuple[Image.Image, str]:
        with Image.open(path) as raw:
            image_format = (raw.format or "JPEG").upper()
            width, height = raw.size
            if width * height > self.settings.max_image_pixels:
                raise DocumentError(
                    "The image dimensions exceed the safe processing limit.",
                    code="IMAGE_TOO_LARGE",
                    status_code=413,
                )
            corrected = ImageOps.exif_transpose(raw)
            if corrected.mode not in {"RGB", "L"}:
                background = Image.new("RGB", corrected.size, (255, 255, 255))
                if corrected.mode in {"RGBA", "LA", "P"}:
                    foreground = corrected.convert("RGBA")
                    background.paste(foreground, mask=foreground.split()[-1])
                    corrected = background
                else:
                    corrected = corrected.convert("RGB")
            normalized = corrected.copy()
        try:
            if image_format == "JPEG":
                normalized.convert("RGB").save(path, format="JPEG", quality=95, optimize=True)
            elif image_format == "PNG":
                normalized.save(path, format="PNG", optimize=True)
            elif image_format == "WEBP":
                normalized.save(path, format="WEBP", quality=95)
            elif image_format == "GIF":
                normalized.convert("RGB").save(path, format="PNG")
                image_format = "PNG"
        except OSError as exc:
            logger.warning("Could not normalize image orientation: %s", exc)
        return normalized, image_format

    def process(
        self,
        inspected: InspectedDocument,
        *,
        requested_languages: list[str],
        on_stage: StageCallback,
        cancel_check: CancelCheck,
    ) -> DocumentResult:
        used_languages, diagnostics = self.ocr.resolve_languages(requested_languages)
        capabilities = self.ocr.capabilities()
        pages: list[DocumentPage] = []
        notes: list[str] = []

        if inspected.kind == DocumentKind.PDF:
            pages = self._process_pdf(
                inspected,
                used_languages=used_languages,
                on_stage=on_stage,
                cancel_check=cancel_check,
                notes=notes,
            )
        else:
            pages = self._process_image(
                inspected,
                used_languages=used_languages,
                on_stage=on_stage,
                cancel_check=cancel_check,
                notes=notes,
            )

        ocr_pages = sum(1 for page in pages if page.ocr_used)
        text_pages = sum(1 for page in pages if page.has_text_layer)
        if inspected.kind == DocumentKind.PDF:
            notes.append(
                f"{text_pages} of {len(pages)} pages used an embedded text layer; {ocr_pages} page(s) used OCR."
            )
        if not capabilities.available:
            diagnostics.append("OCR was unavailable, so scanned pages were returned without extracted text.")
        if used_languages:
            notes.append(
                "OCR languages used: "
                + ", ".join(used_languages)
                + ". Original document presentation remains available."
            )

        return DocumentResult(
            file_name=inspected.file_name,
            document_kind=inspected.kind,
            mime_type=inspected.mime_type,
            size_bytes=inspected.size_bytes,
            page_count=inspected.page_count,
            pages=pages,
            metadata=inspected.metadata,
            requested_ocr_languages=requested_languages,
            used_ocr_languages=used_languages,
            ocr_available=capabilities.available,
            diagnostics=diagnostics,
            processing_notes=notes,
        )

    def _process_pdf(
        self,
        inspected: InspectedDocument,
        *,
        used_languages: list[str],
        on_stage: StageCallback,
        cancel_check: CancelCheck,
        notes: list[str],
    ) -> list[DocumentPage]:
        pages: list[DocumentPage] = []
        try:
            document = pymupdf.open(str(inspected.file_path))
        except Exception as exc:
            raise DocumentError("The PDF could not be opened.", code="CORRUPT_PDF") from exc
        try:
            total = document.page_count
            for index in range(total):
                if cancel_check():
                    raise ProcessingCancelled()
                page_number = index + 1
                on_stage(f"Reading page {page_number} of {total}", (index) / max(total, 1))
                try:
                    page = document.load_page(index)
                except Exception as exc:
                    pages.append(
                        DocumentPage(
                            page_number=page_number,
                            warnings=[f"This page could not be loaded: {exc}"],
                        )
                    )
                    continue

                raw_text = page.get_text("text") or ""
                normalized = normalize_inline(raw_text)
                has_text_layer = len(normalized) >= 40
                width = float(page.rect.width)
                height = float(page.rect.height)
                page_warnings: list[str] = []
                ocr_used = False
                confidence: float | None = None
                ocr_language: str | None = None

                if has_text_layer:
                    text = raw_text.strip()
                elif used_languages:
                    on_stage(f"Running OCR on page {page_number} of {total}", (index + 0.4) / max(total, 1))
                    if cancel_check():
                        raise ProcessingCancelled()
                    try:
                        pixmap = page.get_pixmap(dpi=self.settings.ocr_dpi, alpha=False)
                        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
                        outcome = self.ocr.ocr_image(image, used_languages)
                        text = outcome.text
                        confidence = outcome.confidence
                        ocr_used = True
                        ocr_language = "+".join(outcome.used_languages) if outcome.used_languages else None
                        page_warnings.extend(outcome.warnings)
                        if not text:
                            page_warnings.append(
                                "No OCR text was produced for this page. The original page image is still available."
                            )
                    except ProcessingCancelled:
                        raise
                    except Exception as exc:
                        text = ""
                        page_warnings.append(f"OCR failed for this page: {exc}")
                else:
                    text = ""
                    page_warnings.append("This page has no extractable text layer and OCR is unavailable.")

                pages.append(
                    DocumentPage(
                        page_number=page_number,
                        width=round(width, 2),
                        height=round(height, 2),
                        has_text_layer=has_text_layer,
                        text=text,
                        ocr_used=ocr_used,
                        ocr_confidence=confidence,
                        ocr_language=ocr_language,
                        warnings=page_warnings,
                    )
                )
            if used_languages:
                notes.append(
                    f"OCR processed scanned pages at {self.settings.ocr_dpi} DPI using {', '.join(used_languages)}."
                )
            return pages
        finally:
            document.close()

    def _process_image(
        self,
        inspected: InspectedDocument,
        *,
        used_languages: list[str],
        on_stage: StageCallback,
        cancel_check: CancelCheck,
        notes: list[str],
    ) -> list[DocumentPage]:
        if cancel_check():
            raise ProcessingCancelled()
        on_stage("Correcting image orientation", 0.2)
        image, image_format = self._normalize_image(inspected.file_path)
        inspected.metadata["format"] = image_format
        page_warnings: list[str] = []
        text = ""
        confidence: float | None = None
        ocr_used = False
        if used_languages:
            on_stage("Running OCR on the image", 0.5)
            if cancel_check():
                raise ProcessingCancelled()
            outcome = self.ocr.ocr_image(image, used_languages)
            text = outcome.text
            confidence = outcome.confidence
            ocr_used = True
            page_warnings.extend(outcome.warnings)
        else:
            page_warnings.append("OCR is unavailable, so no text was extracted from this image.")
        notes.append("The image was orientation-corrected before OCR.")
        return [
            DocumentPage(
                page_number=1,
                width=float(image.width),
                height=float(image.height),
                has_text_layer=False,
                text=text,
                ocr_used=ocr_used,
                ocr_confidence=confidence,
                ocr_language="+".join(used_languages) if used_languages else None,
                warnings=page_warnings,
            )
        ]
