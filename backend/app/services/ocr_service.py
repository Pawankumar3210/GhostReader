from __future__ import annotations

import logging
import re
import shutil
import subprocess
import threading
import time
from dataclasses import dataclass, field

from PIL import Image

from app.core.config import Settings

logger = logging.getLogger(__name__)

_LANGUAGE_LABELS = {
    "eng": "English",
    "kan": "Kannada",
    "hin": "Hindi",
    "tam": "Tamil",
    "tel": "Telugu",
    "mal": "Malayalam",
}


def language_label(code: str) -> str:
    return _LANGUAGE_LABELS.get(code, code)


@dataclass
class OcrCapabilities:
    available: bool
    command: str | None = None
    version: str | None = None
    languages: list[str] = field(default_factory=list)
    error: str | None = None


@dataclass
class OcrOutcome:
    text: str
    confidence: float | None
    used_languages: list[str]
    warnings: list[str] = field(default_factory=list)


class OcrService:
    """Tesseract OCR with explicit English + Kannada language diagnostics."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._lock = threading.Lock()
        self._capabilities: OcrCapabilities | None = None
        self._capabilities_checked_at = 0.0
        self._capability_ttl = 60.0

    def _command(self) -> str | None:
        if self.settings.tesseract_cmd:
            return self.settings.tesseract_cmd
        return shutil.which("tesseract")

    def capabilities(self, *, refresh: bool = False) -> OcrCapabilities:
        with self._lock:
            now = time.monotonic()
            if (
                not refresh
                and self._capabilities is not None
                and now - self._capabilities_checked_at < self._capability_ttl
            ):
                return self._capabilities
            capabilities = self._detect()
            self._capabilities = capabilities
            self._capabilities_checked_at = now
            return capabilities

    def _detect(self) -> OcrCapabilities:
        command = self._command()
        if not command:
            return OcrCapabilities(
                available=False,
                error=(
                    "Tesseract is not installed or not on PATH. Scanned pages and images will not be OCR processed. "
                    "Install tesseract-ocr with eng and kan language data, or use the provided Docker image."
                ),
            )
        try:
            version_output = subprocess.run(
                [command, "--version"],
                check=False,
                capture_output=True,
                text=True,
                timeout=10,
            )
            version = (version_output.stdout or version_output.stderr).splitlines()[0].strip()
        except Exception as exc:
            return OcrCapabilities(
                available=False,
                command=command,
                error=f"Tesseract could not be executed: {exc}",
            )
        try:
            langs_output = subprocess.run(
                [command, "--list-langs"],
                check=False,
                capture_output=True,
                text=True,
                timeout=10,
            )
            lines = [
                line.strip()
                for line in (langs_output.stdout or "").splitlines()
                if line.strip() and not line.startswith("List of available languages")
            ]
            languages = sorted(set(lines))
        except Exception as exc:
            return OcrCapabilities(
                available=False,
                command=command,
                version=version,
                error=f"Tesseract language data could not be listed: {exc}",
            )
        if not languages:
            return OcrCapabilities(
                available=False,
                command=command,
                version=version,
                error="Tesseract is installed but no language data was found (for example eng or kan).",
            )
        return OcrCapabilities(
            available=True,
            command=command,
            version=version,
            languages=languages,
        )

    def resolve_languages(self, requested: list[str]) -> tuple[list[str], list[str]]:
        capabilities = self.capabilities()
        diagnostics: list[str] = []
        if not capabilities.available:
            diagnostics.append(capabilities.error or "Tesseract is unavailable.")
            return [], diagnostics

        installed = set(capabilities.languages)
        requested = requested or ["eng"]
        used: list[str] = []
        for code in requested:
            if code in installed:
                used.append(code)
            else:
                diagnostics.append(
                    f"Requested OCR language '{code}' ({language_label(code)}) is not installed. "
                    "OCR was not performed with that language."
                )
        if requested and not used:
            diagnostics.append(
                "None of the requested OCR languages are installed; OCR processing was skipped."
            )
        return used, diagnostics

    def ocr_image(self, image: Image.Image, languages: list[str]) -> OcrOutcome:
        if not languages:
            return OcrOutcome(text="", confidence=None, used_languages=[])

        capabilities = self.capabilities()
        if not capabilities.available:
            return OcrOutcome(
                text="",
                confidence=None,
                used_languages=[],
                warnings=[capabilities.error or "Tesseract is unavailable."],
            )

        try:
            import pytesseract
            from pytesseract import Output
        except Exception as exc:  # pragma: no cover - optional dependency
            return OcrOutcome(
                text="",
                confidence=None,
                used_languages=[],
                warnings=[f"pytesseract is unavailable: {exc}"],
            )

        if self.settings.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = self.settings.tesseract_cmd

        if image.mode not in {"RGB", "L"}:
            image = image.convert("RGB")

        lang = "+".join(languages)
        warnings: list[str] = []
        try:
            data = pytesseract.image_to_data(
                image,
                lang=lang,
                config="--oem 1 --psm 3",
                output_type=Output.DICT,
            )
        except Exception as exc:
            logger.warning("OCR failed: %s", exc)
            return OcrOutcome(
                text="",
                confidence=None,
                used_languages=languages,
                warnings=[f"OCR failed with the configured language data ({lang}): {exc}"],
            )

        lines: list[str] = []
        confidence_values: list[float] = []
        current_key: tuple[int, int, int] | None = None
        current_words: list[str] = []

        def flush() -> None:
            nonlocal current_words
            if current_words:
                lines.append(" ".join(current_words))
                current_words = []

        count = len(data.get("text", []))
        for index in range(count):
            word = (data["text"][index] or "").strip()
            if not word:
                continue
            key = (
                int(data.get("block_num", [0] * count)[index] or 0),
                int(data.get("par_num", [0] * count)[index] or 0),
                int(data.get("line_num", [0] * count)[index] or 0),
            )
            if current_key is not None and key != current_key:
                flush()
            current_key = key
            current_words.append(word)
            try:
                conf = float(data["conf"][index])
            except (TypeError, ValueError):
                conf = -1.0
            if conf >= 0:
                confidence_values.append(conf)
        flush()

        text = "\n".join(lines).strip()
        text = re.sub(r"\n{3,}", "\n\n", text)
        confidence = round(sum(confidence_values) / len(confidence_values), 1) if confidence_values else None

        if not text:
            warnings.append("No text was recognized on this page.")
        elif confidence is not None and confidence < 55:
            warnings.append(
                "OCR confidence is low. The extracted text may contain significant recognition errors."
            )
        if "kan" in languages:
            warnings.append(
                "Kannada OCR is enabled. Recognition of complex scripts can contain errors; compare with the original page."
            )

        return OcrOutcome(
            text=text,
            confidence=confidence,
            used_languages=languages,
            warnings=warnings,
        )

    def status_summary(self) -> dict[str, object]:
        capabilities = self.capabilities()
        return {
            "available": capabilities.available,
            "version": capabilities.version,
            "languages": capabilities.languages,
            "english_available": "eng" in capabilities.languages,
            "kannada_available": "kan" in capabilities.languages,
            "error": capabilities.error,
        }
