import type { jsPDF as JsPdf } from "jspdf";

import { mediaUrl } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { NewspaperPage } from "@/types/api";

export type PdfQuality = "low" | "medium" | "high";

export const PDF_QUALITY_ORDER: PdfQuality[] = ["low", "medium", "high"];

export const PDF_QUALITY_PRESETS: Record<
  PdfQuality,
  { label: string; summary: string; targetWidth: number | null; jpegQuality: number }
> = {
  low: {
    label: "Low",
    summary: "Smaller file · 116 DPI",
    targetWidth: 960,
    jpegQuality: 0.7,
  },
  medium: {
    label: "Medium",
    summary: "Balanced · 218 DPI",
    targetWidth: 1800,
    jpegQuality: 0.84,
  },
  high: {
    label: "High",
    summary: "Native · full detail",
    targetWidth: null,
    jpegQuality: 0.95,
  },
};

const PAGE_WIDTH_PT = 595.28;
const MAX_CANVAS_DIMENSION = 8192;

export function pdfScaleForQuality(width: number, height: number, quality: PdfQuality): number {
  const preset = PDF_QUALITY_PRESETS[quality];
  const dimensionLimit = MAX_CANVAS_DIMENSION / Math.max(width, height);
  const targetLimit = preset.targetWidth ? preset.targetWidth / width : 1;
  return Math.max(0.01, Math.min(1, dimensionLimit, targetLimit));
}

export function sanitizePdfFilename(value: string, fallback = "newspaper-edition"): string {
  const clean = value
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${clean || fallback}.pdf`;
}

export function defaultPdfFilename(title: string | null, publishedAt: string | null): string {
  const parts = [title?.trim() || "Newspaper edition"];
  if (publishedAt) parts.push(formatDate(publishedAt));
  return sanitizePdfFilename(parts.join(" - "));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await new Promise<void>((resolve, reject) => {
    if (image.complete && image.naturalWidth > 0) {
      resolve();
      return;
    }
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The page image could not be decoded."));
  });
  return image;
}

async function decodePageImage(source: string) {
  const response = await fetch(source, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Page download failed with HTTP ${response.status}.`);
  }
  const blob = await response.blob();

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap as CanvasImageSource,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Fall through to an HTML image for browsers without AVIF bitmap support.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await loadHtmlImage(objectUrl);
    return {
      source: image as CanvasImageSource,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function downloadNewspaperPdf({
  pages,
  filename,
  title,
  quality = "high",
  onProgress,
}: {
  pages: NewspaperPage[];
  filename: string;
  title: string;
  quality?: PdfQuality;
  onProgress?: (current: number, total: number) => void;
}) {
  if (pages.length === 0) {
    throw new Error("This edition has no newspaper pages to download.");
  }

  const { jsPDF } = await import("jspdf");
  const preset = PDF_QUALITY_PRESETS[quality];
  let pdf: JsPdf | null = null;

  for (const [index, page] of pages.entries()) {
    onProgress?.(index + 1, pages.length);
    const source = mediaUrl(page.proxy_url ?? page.image_url);
    if (!source) throw new Error(`Page ${page.page_number} has no image URL.`);

    const image = await decodePageImage(source);
    try {
      const scale = pdfScaleForQuality(image.width, image.height, quality);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("The browser could not prepare the page canvas.");

      context.fillStyle = "#ffffff";
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image.source, 0, 0, canvas.width, canvas.height);

      const imageData = canvas.toDataURL("image/jpeg", preset.jpegQuality);
      const pageHeight = (PAGE_WIDTH_PT * canvas.height) / canvas.width;
      canvas.width = 0;
      canvas.height = 0;
      const orientation = pageHeight >= PAGE_WIDTH_PT ? "portrait" : "landscape";
      const format: [number, number] = [PAGE_WIDTH_PT, pageHeight];

      if (!pdf) {
        pdf = new jsPDF({ orientation, unit: "pt", format, compress: true });
        pdf.setProperties({
          title,
          subject: `${pages.length} public newspaper pages · ${preset.label} quality`,
          creator: "Ghost Reader",
        });
      } else {
        pdf.addPage(format, orientation);
      }
      pdf.addImage(imageData, "JPEG", 0, 0, PAGE_WIDTH_PT, pageHeight, undefined, "FAST");
    } finally {
      image.dispose();
    }
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  if (!pdf) throw new Error("The PDF could not be created.");
  onProgress?.(pages.length, pages.length);
  downloadBlob(pdf.output("blob"), sanitizePdfFilename(filename));
}
