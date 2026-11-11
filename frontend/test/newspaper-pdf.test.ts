import { describe, expect, it } from "vitest";

import {
  defaultPdfFilename,
  PDF_QUALITY_PRESETS,
  pdfScaleForQuality,
  sanitizePdfFilename,
} from "@/lib/newspaper-pdf";

describe("newspaper PDF file names", () => {
  it("removes duplicate extensions and unsafe characters", () => {
    expect(sanitizePdfFilename("  Vijay: Karnataka / 10|11.PDF  ")).toBe(
      "Vijay Karnataka 10 11.pdf",
    );
  });

  it("falls back when the name is empty", () => {
    expect(sanitizePdfFilename("   ", "Vijay Karnataka")).toBe("Vijay Karnataka.pdf");
  });

  it("builds a readable default from the edition metadata", () => {
    expect(defaultPdfFilename("Vijay Karnataka", "2026-11-10T12:00:00Z")).toBe(
      "Vijay Karnataka - November 10, 2026.pdf",
    );
  });
});

describe("newspaper PDF quality presets", () => {
  it("scales low and medium output while keeping high native", () => {
    expect(pdfScaleForQuality(3437, 5396, "low")).toBeCloseTo(960 / 3437);
    expect(pdfScaleForQuality(3437, 5396, "medium")).toBeCloseTo(1800 / 3437);
    expect(pdfScaleForQuality(3437, 5396, "high")).toBe(1);
  });

  it("caps every preset at the canvas dimension limit", () => {
    expect(pdfScaleForQuality(10_000, 20_000, "high")).toBeCloseTo(8192 / 20_000);
  });

  it("keeps progressively higher JPEG quality", () => {
    expect(PDF_QUALITY_PRESETS.low.jpegQuality).toBeLessThan(
      PDF_QUALITY_PRESETS.medium.jpegQuality,
    );
    expect(PDF_QUALITY_PRESETS.medium.jpegQuality).toBeLessThan(
      PDF_QUALITY_PRESETS.high.jpegQuality,
    );
  });
});
