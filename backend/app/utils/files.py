from __future__ import annotations

import re
import uuid
from pathlib import Path

from app.core.errors import DocumentError

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._ -]+")
_PDF_MAGIC = b"%PDF-"
_JPEG_MAGIC = b"\xff\xd8\xff"
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_WEBP_MAGIC = b"RIFF"
_GIF_MAGIC = (b"GIF87a", b"GIF89a")


def sanitize_filename(name: str | None, fallback: str = "document") -> str:
    name = (name or "").strip().replace("\\", "/").split("/")[-1]
    name = _SAFE_NAME_RE.sub("_", name).strip("._ ")
    if not name:
        name = fallback
    return name[:120]


def new_storage_name(suffix: str = "") -> str:
    token = uuid.uuid4().hex
    suffix = suffix if re.fullmatch(r"\.[A-Za-z0-9]{1,8}", suffix or "") else ""
    return f"{token}{suffix}"


def sniff_content_kind(head: bytes, filename: str | None = None) -> str | None:
    lower = (filename or "").lower()
    if head.startswith(_PDF_MAGIC):
        return "PDF_DOCUMENT"
    if head.startswith(_JPEG_MAGIC):
        return "IMAGE_DOCUMENT"
    if head.startswith(_PNG_MAGIC):
        return "IMAGE_DOCUMENT"
    if head.startswith(_WEBP_MAGIC):
        return "IMAGE_DOCUMENT"
    if head.startswith(_GIF_MAGIC):
        return "IMAGE_DOCUMENT"
    if lower.endswith(".svg") or b"<svg" in head[:512].lower():
        raise DocumentError(
            "SVG files are not accepted. Please upload a PDF, PNG, JPG or JPEG file.",
            code="UNSAFE_FILE_TYPE",
            status_code=415,
        )
    return None


def ensure_within_directory(path: Path, directory: Path) -> Path:
    resolved = path.resolve()
    root = directory.resolve()
    if root not in resolved.parents and resolved != root:
        raise DocumentError("Unsafe file path.", code="UNSAFE_PATH", status_code=400)
    return resolved


def mime_for_kind(kind: str, filename: str = "") -> str:
    lower = filename.lower()
    if kind == "PDF_DOCUMENT":
        return "application/pdf"
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith(".gif"):
        return "image/gif"
    return "image/jpeg"
