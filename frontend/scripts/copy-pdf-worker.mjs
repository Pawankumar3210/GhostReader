import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = resolve(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const destination = resolve(root, "public/pdf.worker.min.mjs");

try {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  console.log("Copied the PDF.js worker to public/pdf.worker.min.mjs");
} catch (error) {
  console.warn(
    "PDF.js worker was not copied. Run this script after installing dependencies.",
    error.message,
  );
}
