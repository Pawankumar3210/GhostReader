import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const BACKEND_URL = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:8000";

test("analyzes a public page and opens the reader", async ({ page, request }) => {
  const response = await request.get(`${BACKEND_URL}/api/v1/health/ready`).catch(() => null);
  test.skip(!response?.ok(), "The Ghost Reader API is not running.");

  await page.goto("/analyze");
  await page.getByLabel("Public page address").fill("https://example.com/");
  await page.getByRole("button", { name: /Build the edition/ }).click();

  await page.waitForURL(/\/analyze\/[a-f0-9]+/, { timeout: 30_000 });
  await expect(page.getByText("Edition ready")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Example Domain" })).toBeVisible();

  await page.getByRole("link", { name: /Open reader/ }).click();
  await page.waitForURL(/\/reader\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Example Domain", level: 1 })).toBeVisible();
  await expect(page.locator(".reader-root").first()).toBeVisible();
});

test("uploads an image and returns Kannada + English OCR", async ({ page, request }) => {
  const response = await request.get(`${BACKEND_URL}/api/v1/health/ready`).catch(() => null);
  test.skip(!response?.ok(), "The Ghost Reader API is not running.");
  const report = await response?.json();
  test.skip(
    !report?.checks?.ocr?.kannada_available || !report?.checks?.ocr?.english_available,
    "Kannada and English Tesseract models are not installed.",
  );

  await page.goto("/documents");
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(__dirname, "fixtures", "ocr-test.png"));
  await page.getByRole("button", { name: /Extract text/ }).click();

  await page.waitForURL(/\/documents\/[a-f0-9]+/, { timeout: 30_000 });
  await expect(page.getByText(/Ghost Reader English OCR test/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/ಘೋಸ್ಟ್/).first()).toBeVisible();
  await expect(page.getByText(/OCR ·/).first()).toBeVisible();
});

test("discovers and renders every public e-paper page", async ({ page, request }) => {
  test.setTimeout(600_000);
  const response = await request.get(`${BACKEND_URL}/api/v1/health/ready`).catch(() => null);
  test.skip(!response?.ok(), "The Ghost Reader API is not running.");

  const created = await request.post(`${BACKEND_URL}/api/v1/analyze`, {
    data: { url: "https://www.vijaykarnatakaepaper.com/vijay-karnataka?pgdate=2026-11-10" },
  });
  expect(created.ok()).toBeTruthy();
  const jobId = (await created.json()).job_id as string;

  let result: { newspaper_pages?: { page_number: number }[] } | null = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const poll = await request.get(`${BACKEND_URL}/api/v1/jobs/${jobId}`);
    const job = await poll.json();
    if (job.status === "SUCCEEDED") {
      result = job.result;
      break;
    }
    if (job.status === "FAILED") throw new Error(job.error?.message ?? "E-paper analysis failed");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  expect(result?.newspaper_pages?.length).toBeGreaterThan(1);
  const pageCount = result?.newspaper_pages?.length ?? 0;

  await page.goto(`/reader/${jobId}`);
  await expect(page.getByRole("heading", { name: "Vijay Karnataka", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("November 10, 2026").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: `All ${pageCount} pages` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Open page 1 of ${pageCount}` })).toBeVisible();

  await page.getByRole("button", { name: `Open page 1 of ${pageCount}` }).click();
  const viewer = page.getByRole("dialog");
  await expect(viewer.getByText(`Page 1 of ${pageCount}`)).toBeVisible();
  await expect
    .poll(
      () =>
        viewer
          .locator("img")
          .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      { timeout: 30_000 },
    )
    .toBe(true);
  await viewer.getByRole("button", { name: "Next page" }).click();
  await expect(viewer.getByText(`Page 2 of ${pageCount}`)).toBeVisible();
  await viewer.getByRole("button", { name: "Close page viewer" }).click();

  await page.goto(`/newspaper/${jobId}`);
  const newspaperRoot = page.locator(".newspaper-root");
  await expect(newspaperRoot).toHaveAttribute("data-reader-theme", "paper");
  await page.getByRole("button", { name: "Night" }).click();
  await expect(newspaperRoot).toHaveAttribute("data-reader-theme", "night");
  await page.getByRole("button", { name: "Sepia" }).click();
  await expect(newspaperRoot).toHaveAttribute("data-reader-theme", "sepia");
  await page.getByRole("button", { name: "Paper" }).click();
  await expect(newspaperRoot).toHaveAttribute("data-reader-theme", "paper");

  await page.getByRole("button", { name: `Download all ${pageCount} pages as PDF` }).click();
  const pdfDialog = page.getByRole("dialog");
  await expect(pdfDialog.getByText(/All \d+ newspaper pages are included/)).toBeVisible();
  await expect(pdfDialog.getByRole("radio", { name: "High" })).toBeChecked();
  await pdfDialog.getByLabel("PDF file name").fill("vijay-karnataka-2026-11-10");

  const highDownloadPromise = page.waitForEvent("download", { timeout: 240_000 });
  await pdfDialog.getByRole("button", { name: "Download PDF" }).click();
  const highDownload = await highDownloadPromise;
  expect(highDownload.suggestedFilename()).toBe("vijay-karnataka-2026-11-10.pdf");

  const highDownloadPath = await highDownload.path();
  expect(highDownloadPath).toBeTruthy();
  const highBytes = await readFile(highDownloadPath!);
  expect(highBytes.byteLength).toBeGreaterThan(1_000_000);

  await expect(pdfDialog).toBeHidden();
  await page.getByRole("button", { name: `Download all ${pageCount} pages as PDF` }).click();
  await expect(pdfDialog.getByRole("radio", { name: "High" })).toBeChecked();
  await pdfDialog.getByText("Low", { exact: true }).click();
  await expect(pdfDialog.getByRole("radio", { name: "Low" })).toBeChecked();
  await pdfDialog.getByLabel("PDF file name").fill("vijay-karnataka-2026-11-10-low");

  const lowDownloadPromise = page.waitForEvent("download", { timeout: 240_000 });
  await pdfDialog.getByRole("button", { name: "Download PDF" }).click();
  const lowDownload = await lowDownloadPromise;
  expect(lowDownload.suggestedFilename()).toBe("vijay-karnataka-2026-11-10-low.pdf");

  const lowDownloadPath = await lowDownload.path();
  expect(lowDownloadPath).toBeTruthy();
  const lowBytes = await readFile(lowDownloadPath!);
  expect(lowBytes.byteLength).toBeLessThan(highBytes.byteLength * 0.6);
  expect(lowBytes.byteLength).toBeGreaterThan(100_000);
  console.log(
    `PDF export sizes: high=${(highBytes.byteLength / 1024 / 1024).toFixed(1)} MB, low=${(
      lowBytes.byteLength /
      1024 /
      1024
    ).toFixed(1)} MB`,
  );

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  for (const bytes of [highBytes, lowBytes]) {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
    expect(pdf.numPages).toBe(pageCount);
    const firstPage = await pdf.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    expect(viewport.width).toBeCloseTo(595.28, 1);
    expect(viewport.height).toBeGreaterThan(800);
    await pdf.destroy();
  }
});
