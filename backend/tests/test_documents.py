from __future__ import annotations

import os
import time
from pathlib import Path

import pymupdf
import pytest
from PIL import Image, ImageDraw, ImageFont

from app.core.config import Settings
from app.core.errors import DocumentError
from app.schemas.enums import DocumentKind
from app.services.document_processor import DocumentProcessor
from app.services.ocr_service import OcrCapabilities, OcrOutcome, OcrService


class FakeOcr(OcrService):
    def __init__(self, settings: Settings, languages: list[str] | None = None) -> None:
        super().__init__(settings)
        self.languages = languages if languages is not None else ["eng", "kan"]

    def capabilities(self, *, refresh: bool = False) -> OcrCapabilities:
        return OcrCapabilities(
            available=True,
            command="fake-tesseract",
            version="tesseract 5",
            languages=self.languages,
        )

    def ocr_image(self, image: Image.Image, languages: list[str]) -> OcrOutcome:
        return OcrOutcome(
            text="ನಮಸ್ಕಾರ Ghost Reader\nSynthetic OCR text",
            confidence=88.5,
            used_languages=languages,
            warnings=[],
        )


def make_pdf(path: Path, *, pages: int = 2, text: bool = True) -> None:
    document = pymupdf.open()
    for index in range(pages):
        page = document.new_page()
        if text:
            page.insert_text(
                (72, 72),
                f"Embedded text for page {index + 1}. "
                "This sentence is long enough to count as an extractable text layer for testing.",
                fontsize=11,
            )
    document.save(str(path))
    document.close()


def test_inspect_pdf_and_reject_corrupt(tmp_path: Path, settings: Settings) -> None:  # type: ignore[no-untyped-def]
    pdf_path = tmp_path / "sample.pdf"
    make_pdf(pdf_path, pages=2)
    processor = DocumentProcessor(settings, FakeOcr(settings))
    inspected = processor.inspect(pdf_path, "sample.pdf")
    assert inspected.kind == DocumentKind.PDF
    assert inspected.page_count == 2

    corrupt = tmp_path / "corrupt.pdf"
    corrupt.write_bytes(b"%PDF-1.7\nnot really a pdf")
    with pytest.raises(DocumentError) as error:
        processor.inspect(corrupt, "corrupt.pdf")
    assert error.value.code == "CORRUPT_PDF"


def test_pdf_page_limit(tmp_path: Path, settings: Settings) -> None:  # type: ignore[no-untyped-def]
    pdf_path = tmp_path / "long.pdf"
    make_pdf(pdf_path, pages=3)
    limited = settings.model_copy(update={"max_pdf_pages": 2})
    processor = DocumentProcessor(limited, FakeOcr(limited))
    with pytest.raises(DocumentError) as error:
        processor.inspect(pdf_path, "long.pdf")
    assert error.value.code == "TOO_MANY_PAGES"


def test_pdf_embedded_text_and_ocr_fallback(tmp_path: Path, settings: Settings) -> None:  # type: ignore[no-untyped-def]
    pdf_path = tmp_path / "mixed.pdf"
    document = pymupdf.open()
    first = document.new_page()
    first.insert_text(
        (72, 72),
        "Embedded text for the first page. This sentence is long enough to count as an extractable text layer.",
        fontsize=11,
    )
    document.new_page()
    document.save(str(pdf_path))
    document.close()

    processor = DocumentProcessor(settings, FakeOcr(settings))
    inspected = processor.inspect(pdf_path, "mixed.pdf")
    result = processor.process(
        inspected,
        requested_languages=["eng", "kan"],
        on_stage=lambda message, progress: None,
        cancel_check=lambda: False,
    )
    assert result.page_count == 2
    assert result.used_ocr_languages == ["eng", "kan"]
    assert result.ocr_available is True
    assert result.pages[0].has_text_layer is True
    assert result.pages[0].ocr_used is False
    assert "Embedded text" in result.pages[0].text
    assert result.pages[1].has_text_layer is False
    assert result.pages[1].ocr_used is True
    assert "ನಮಸ್ಕಾರ" in result.pages[1].text
    assert result.pages[1].ocr_confidence == 88.5
    assert result.pages[1].ocr_language == "eng+kan"


def test_image_inspection_and_ocr(tmp_path: Path, settings: Settings) -> None:  # type: ignore[no-untyped-def]
    image_path = tmp_path / "scan.png"
    Image.new("RGB", (640, 480), (240, 240, 230)).save(image_path)
    processor = DocumentProcessor(settings, FakeOcr(settings))
    inspected = processor.inspect(image_path, "scan.png")
    assert inspected.kind == DocumentKind.IMAGE
    assert inspected.image_width == 640
    result = processor.process(
        inspected,
        requested_languages=["eng", "kan"],
        on_stage=lambda message, progress: None,
        cancel_check=lambda: False,
    )
    assert result.document_kind == DocumentKind.IMAGE
    assert result.page_count == 1
    assert result.pages[0].width == 640
    assert "ನಮಸ್ಕಾರ" in result.pages[0].text


def test_svg_and_fake_images_rejected(tmp_path: Path, settings: Settings) -> None:  # type: ignore[no-untyped-def]
    processor = DocumentProcessor(settings, FakeOcr(settings))
    svg_path = tmp_path / "unsafe.svg"
    svg_path.write_text('<svg xmlns="http://www.w3.org/2000/svg"></svg>', encoding="utf-8")
    with pytest.raises(DocumentError) as error:
        processor.inspect(svg_path, "unsafe.svg")
    assert error.value.code == "UNSAFE_FILE_TYPE"

    fake_png = tmp_path / "fake.png"
    fake_png.write_bytes(b"\x89PNG\r\n\x1a\nnot a real png")
    with pytest.raises(DocumentError):
        processor.inspect(fake_png, "fake.png")


def test_language_resolution_never_silently_claims_kannada(settings: Settings) -> None:
    ocr = OcrService(settings)
    ocr._capabilities = OcrCapabilities(available=True, command="fake", version="5", languages=["eng"])
    ocr._capabilities_checked_at = time.monotonic()
    used, diagnostics = ocr.resolve_languages(["eng", "kan"])
    assert used == ["eng"]
    assert any("kan" in item and "not installed" in item for item in diagnostics)

    ocr._capabilities = OcrCapabilities(available=True, command="fake", version="5", languages=["eng", "kan"])
    used, diagnostics = ocr.resolve_languages(["eng", "kan"])
    assert used == ["eng", "kan"]
    assert diagnostics == []


def test_missing_tesseract_diagnostics(settings: Settings) -> None:
    ocr = OcrService(settings)
    ocr._capabilities = OcrCapabilities(available=False, error="Tesseract missing")
    ocr._capabilities_checked_at = time.monotonic()
    used, diagnostics = ocr.resolve_languages(["eng", "kan"])
    assert used == []
    assert diagnostics == ["Tesseract missing"]


@pytest.mark.skipif(
    not os.environ.get("GR_TEST_TESSERACT_CMD"),
    reason="Set GR_TEST_TESSERACT_CMD to run real Tesseract Kannada/English integration verification.",
)
def test_real_kannada_and_english_ocr(settings: Settings, tmp_path: Path) -> None:  # type: ignore[no-untyped-def]
    font_path = Path("/usr/share/fonts/truetype/noto/NotoSansKannada-Regular.ttf")
    english_font = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    if not font_path.exists() or not english_font.exists():
        pytest.skip("Kannada and English fonts are not installed for generating the fixture image.")
    image = Image.new("RGB", (1500, 320), "white")
    draw = ImageDraw.Draw(image)
    kannada_font = ImageFont.truetype(str(font_path), 64)
    draw.text((40, 30), "ಘೋಸ್ಟ್ ರೀಡರ್ ಓದುವ ಸ್ಥಳ", font=kannada_font, fill="black")
    draw.text(
        (40, 170),
        "Ghost Reader English OCR test",
        font=ImageFont.truetype(str(english_font), 54),
        fill="black",
    )
    image_path = tmp_path / "kannada-scan.png"
    image.save(image_path)

    configured = settings.model_copy(
        update={"tesseract_cmd": os.environ["GR_TEST_TESSERACT_CMD"], "ocr_languages": "eng+kan"}
    )
    ocr = OcrService(configured)
    capabilities = ocr.capabilities(refresh=True)
    assert capabilities.available is True
    assert "eng" in capabilities.languages
    assert "kan" in capabilities.languages

    outcome = ocr.ocr_image(image, ["eng", "kan"])
    assert outcome.confidence is not None and outcome.confidence > 50
    assert "Ghost Reader" in outcome.text
    assert any("\u0c80" <= char <= "\u0cff" for char in outcome.text)
