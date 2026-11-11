from __future__ import annotations

import re
from contextlib import suppress
from pathlib import Path
from typing import Annotated

import anyio
from fastapi import APIRouter, File, Form, Request, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import get_services
from app.core.errors import DocumentError, NotFoundError
from app.schemas.jobs import DocumentJobResponse
from app.utils.files import new_storage_name, sanitize_filename

router = APIRouter(tags=["documents"])

_LANGUAGE_RE = re.compile(r"^[a-zA-Z]{2,8}$")


def _parse_languages(raw: str | None, defaults: list[str]) -> list[str]:
    if not raw:
        return defaults
    parts = [part for part in re.split(r"[+,;\s]+", raw) if part]
    if not parts:
        return defaults
    if len(parts) > 4:
        raise DocumentError("Select no more than four OCR languages.", code="INVALID_OCR_LANGUAGES")
    languages: list[str] = []
    for part in parts:
        if not _LANGUAGE_RE.match(part):
            raise DocumentError("OCR language codes must contain only letters.", code="INVALID_OCR_LANGUAGES")
        code = part.lower()
        if code not in languages:
            languages.append(code)
    return languages


@router.post(
    "/documents",
    response_model=DocumentJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_document(
    request: Request,
    file: Annotated[UploadFile, File()],
    ocr_languages: Annotated[str | None, Form()] = None,
) -> DocumentJobResponse:
    services = get_services(request)
    settings = services.settings
    display_name = sanitize_filename(file.filename)
    suffix = Path(display_name).suffix.lower()
    if suffix not in {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        suffix = ""
    storage_name = new_storage_name(suffix)
    destination = settings.storage_path / storage_name
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)

    requested_languages = _parse_languages(ocr_languages, settings.requested_ocr_languages)
    max_bytes = settings.max_upload_bytes
    written = 0
    try:
        async with await anyio.open_file(destination, "wb") as handle:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    raise DocumentError(
                        "The uploaded file exceeds the permitted size limit.",
                        code="FILE_TOO_LARGE",
                        status_code=413,
                    )
                await handle.write(chunk)
        await file.close()
        if written == 0:
            raise DocumentError("The uploaded file is empty.", code="EMPTY_FILE")
        inspected = await anyio.to_thread.run_sync(services.documents.inspect, destination, display_name)
        return await services.jobs.create_document_job(inspected, requested_languages=requested_languages)
    except Exception:
        with suppress(Exception):
            await file.close()
        with suppress(OSError):
            destination.unlink(missing_ok=True)
        raise


@router.get("/documents/{job_id}", response_model=DocumentJobResponse)
async def get_document_job(job_id: str, request: Request) -> DocumentJobResponse:
    services = get_services(request)
    return await services.jobs.get_document_job(job_id)


@router.get("/documents/{job_id}/file")
async def download_document(job_id: str, request: Request) -> FileResponse:
    services = get_services(request)
    path, name, mime = await services.jobs.get_document_file(job_id)
    return FileResponse(
        path,
        media_type=mime,
        filename=name,
        content_disposition_type="inline",
        headers={
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete("/documents/{job_id}")
async def delete_document(job_id: str, request: Request) -> dict[str, bool]:
    services = get_services(request)
    deleted = await services.jobs.delete_job(job_id)
    if not deleted:
        raise NotFoundError("The document session was not found.", code="DOCUMENT_NOT_FOUND")
    return {"deleted": True}
