"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Download, FileText, Loader2, X } from "lucide-react";
import { useId, useState } from "react";

import {
  defaultPdfFilename,
  downloadNewspaperPdf,
  PDF_QUALITY_ORDER,
  PDF_QUALITY_PRESETS,
  sanitizePdfFilename,
  type PdfQuality,
} from "@/lib/newspaper-pdf";
import { cn } from "@/lib/utils";
import type { NewspaperPage } from "@/types/api";

export function NewspaperPdfButton({
  pages,
  title,
  publishedAt,
  variant = "reader",
}: {
  pages: NewspaperPage[];
  title: string;
  publishedAt: string | null;
  variant?: "reader" | "newspaper";
}) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [filename, setFilename] = useState("");
  const [quality, setQuality] = useState<PdfQuality>("high");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  if (pages.length === 0) return null;

  function openDialog() {
    setFilename(defaultPdfFilename(title, publishedAt));
    setQuality("high");
    setError(null);
    setProgress(null);
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      await downloadNewspaperPdf({
        pages,
        title,
        filename: sanitizePdfFilename(filename, "newspaper-edition"),
        quality,
        onProgress: (current, total) => setProgress({ current, total }),
      });
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The PDF could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label={`Download all ${pages.length} pages as PDF`}
        title={`Download all ${pages.length} pages as PDF`}
        className={
          variant === "reader"
            ? "reader-toolbar-button"
            : "inline-flex h-9 items-center gap-2 rounded-full border border-[color:var(--reader-rule)] bg-[color:var(--reader-card)] px-4 text-xs font-medium text-[color:var(--reader-soft)] transition hover:border-[color:var(--reader-accent)] hover:text-[color:var(--reader-accent)]"
        }
      >
        <Download className="size-4" />
        <span className={variant === "reader" ? "hidden lg:inline" : undefined}>PDF</span>
      </button>

      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[110] bg-[#0f0e0c]/65 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-[111] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-paper-soft p-5 text-ink shadow-2xl"
            onEscapeKeyDown={(event) => busy && event.preventDefault()}
            onPointerDownOutside={(event) => busy && event.preventDefault()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  <FileText className="size-3.5" /> Newspaper PDF
                </p>
                <Dialog.Title className="mt-2 font-serif text-2xl leading-tight">
                  Download edition
                </Dialog.Title>
                <Dialog.Description className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                  All {pages.length} newspaper pages are included. Choose a quality, then name your
                  file. Reader chrome and article text are not included.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={busy}
                  aria-label="Close PDF dialog"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-ink/5 hover:text-ink disabled:opacity-40"
                >
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </div>

            <form className="mt-5" onSubmit={handleSubmit}>
              <fieldset disabled={busy}>
                <legend className="text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-soft">
                  Download quality
                </legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {PDF_QUALITY_ORDER.map((value) => {
                    const preset = PDF_QUALITY_PRESETS[value];
                    const selected = quality === value;
                    return (
                      <label
                        key={value}
                        className={cn(
                          "relative flex cursor-pointer flex-col rounded-xl border px-2.5 py-2.5 transition focus-within:ring-2 focus-within:ring-accent/35",
                          selected
                            ? "border-accent bg-accent-soft/65 text-accent-dark"
                            : "border-line bg-paper text-ink-soft hover:border-ink-muted",
                          busy && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <input
                          type="radio"
                          name="pdf-quality"
                          value={value}
                          checked={selected}
                          onChange={() => setQuality(value)}
                          aria-label={preset.label}
                          className="sr-only"
                        />
                        <span className="flex items-center justify-between gap-1 text-xs font-semibold">
                          {preset.label}
                          <span
                            className={cn(
                              "size-2 rounded-full border",
                              selected ? "border-accent bg-accent" : "border-line bg-transparent",
                            )}
                          />
                        </span>
                        <span className="mt-1 text-[9px] leading-tight text-ink-muted">
                          {preset.summary}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label
                htmlFor={inputId}
                className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-soft"
              >
                PDF file name
              </label>
              <input
                id={inputId}
                value={filename}
                onChange={(event) => setFilename(event.target.value)}
                disabled={busy}
                autoFocus
                spellCheck={false}
                className="mt-2 h-11 w-full rounded-xl border border-line bg-paper px-3 font-sans text-sm text-ink outline-none transition focus:border-ink-muted disabled:opacity-60"
              />
              <p className="mt-1.5 text-[10px] text-ink-muted">
                The `.pdf` extension is added automatically.
              </p>

              {progress && (
                <div
                  className="mt-4"
                  role="status"
                  aria-live="polite"
                  aria-label={`Preparing page ${progress.current} of ${progress.total}`}
                >
                  <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                    <span>Preparing pages</span>
                    <span>
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-200"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2 text-xs leading-relaxed text-accent-dark"
                >
                  {error}
                </p>
              )}

              <div className="mt-5 flex items-center justify-end gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex h-10 items-center rounded-full px-4 text-xs font-medium text-ink-soft transition hover:bg-ink/5 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={busy || !filename.trim()}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-xs font-medium text-paper transition hover:bg-ink/90 disabled:opacity-55"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  {busy && progress
                    ? `Page ${progress.current} of ${progress.total}`
                    : busy
                      ? "Preparing…"
                      : "Download PDF"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
