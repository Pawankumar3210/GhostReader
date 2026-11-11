"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  Download,
  FileText,
  Languages,
  Minus,
  Plus,
  ScanLine,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { PdfPreview } from "@/components/documents/pdf-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn, formatBytes, formatDateTime } from "@/lib/utils";
import type { DocumentJob, DocumentPage } from "@/types/api";

function highlight(text: string, query: string) {
  const needle = query.trim();
  if (!needle) return text;
  const pattern = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const splitter = new RegExp(`(${pattern})`, "gi");
  const matcher = new RegExp(pattern, "i");
  return text.split(splitter).map((part, index) =>
    matcher.test(part) ? (
      <mark key={index} className="rounded-sm bg-gold-soft px-0.5 text-ink">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export function DocumentViewer({
  job,
  result,
}: {
  job: DocumentJob;
  result: NonNullable<DocumentJob["result"]>;
}) {
  const router = useRouter();
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  const selectedPage: DocumentPage | undefined =
    result.pages.find((page) => page.page_number === pageNumber) ?? result.pages[0];
  const isPdf = result.document_kind === "PDF_DOCUMENT";
  const fileUrl = api.documentFileUrl(job.job_id);

  const matchCount = useMemo(() => {
    if (!query.trim() || !selectedPage) return 0;
    const pattern = new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    return selectedPage.text.match(pattern)?.length ?? 0;
  }, [query, selectedPage]);

  const pagesWithMatches = useMemo(() => {
    if (!query.trim()) return new Set<number>();
    const pattern = new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    return new Set(
      result.pages.filter((page) => pattern.test(page.text)).map((page) => page.page_number),
    );
  }, [query, result.pages]);

  const warnings = useMemo(() => {
    const perPage = result.pages.flatMap((page) =>
      page.warnings.map((warning) => `Page ${page.page_number}: ${warning}`),
    );
    return Array.from(new Set([...result.diagnostics, ...perPage]));
  }, [result]);

  async function copyPage() {
    if (!selectedPage?.text) return;
    try {
      await navigator.clipboard.writeText(selectedPage.text);
      setNotice("Page text copied.");
    } catch {
      setNotice("Could not access the clipboard.");
    }
  }

  async function endSession() {
    setRemoving(true);
    try {
      await api.deleteDocumentJob(job.job_id);
    } catch {
      // The session may already have expired; continue to the uploader.
    }
    router.push("/documents");
  }

  function goPage(next: number) {
    setPageNumber(Math.min(Math.max(next, 1), result.page_count || 1));
  }

  return (
    <div className="container-editorial py-8 md:py-12">
      <div className="mx-auto max-w-[1240px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/documents"
            className="inline-flex items-center gap-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" /> Documents
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={fileUrl} target="_blank" rel="noreferrer noopener">
                <Download className="size-3.5" /> Original file
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void endSession()}
              disabled={removing}
              className="text-ink-muted hover:text-accent"
            >
              <Trash2 className="size-3.5" /> {removing ? "Ending…" : "End session"}
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-line bg-paper-soft p-5 md:flex-row md:items-center md:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-2xl leading-tight text-ink">
                {result.file_name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                <span className="uppercase tracking-[0.1em]">
                  {isPdf ? "PDF document" : "Image document"}
                </span>
                <span>{formatBytes(result.size_bytes)}</span>
                <span>{result.page_count} pages</span>
                <span>Expires {formatDateTime(job.expires_at)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={result.ocr_available ? "forest" : "gold"}>
              <ScanLine className="size-3" />{" "}
              {result.ocr_available ? "OCR ready" : "OCR unavailable"}
            </Badge>
            {result.used_ocr_languages.map((language) => (
              <Badge key={language} variant="outline">
                <Languages className="size-3" /> {language}
              </Badge>
            ))}
          </div>
        </div>

        {warnings.length > 0 && (
          <details className="group mt-4 rounded-xl border border-gold/30 bg-gold-soft/50 px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-ink-soft">
              <CircleAlert className="size-3.5 text-gold" />
              {warnings.length} processing diagnostic{warnings.length === 1 ? "" : "s"}
              <ChevronRight className="ml-auto size-3.5 transition-transform group-open:rotate-90" />
            </summary>
            <ul className="mt-3 space-y-1.5 border-t border-gold/20 pt-3 text-[11px] leading-relaxed text-ink-soft">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="overflow-hidden rounded-2xl border border-line bg-paper-soft shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Page preview
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => goPage(pageNumber - 1)}
                  disabled={pageNumber <= 1}
                  aria-label="Previous page"
                  className="grid size-8 place-items-center rounded-full border border-line text-ink-muted transition hover:text-ink disabled:opacity-35"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <span className="min-w-[72px] text-center font-mono text-[10px] text-ink-muted">
                  {pageNumber} / {result.page_count}
                </span>
                <button
                  type="button"
                  onClick={() => goPage(pageNumber + 1)}
                  disabled={pageNumber >= result.page_count}
                  aria-label="Next page"
                  className="grid size-8 place-items-center rounded-full border border-line text-ink-muted transition hover:text-ink disabled:opacity-35"
                >
                  <ChevronRight className="size-3.5" />
                </button>
                {isPdf && (
                  <>
                    <span className="mx-1 h-4 w-px bg-line" />
                    <button
                      type="button"
                      onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}
                      aria-label="Zoom out"
                      className="grid size-7 place-items-center rounded-full text-ink-muted hover:bg-paper-deep"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="w-9 text-center font-mono text-[10px] text-ink-muted">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoom((value) => Math.min(2, value + 0.1))}
                      aria-label="Zoom in"
                      className="grid size-7 place-items-center rounded-full text-ink-muted hover:bg-paper-deep"
                    >
                      <Plus className="size-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="p-3 md:p-4">
              {isPdf ? (
                <PdfPreview url={fileUrl} page={pageNumber} zoom={zoom} />
              ) : (
                <div className="flex min-h-[320px] items-center justify-center overflow-auto rounded-xl bg-paper-deep/40 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fileUrl}
                    alt={`Page ${pageNumber} of ${result.file_name}`}
                    className="max-h-[70vh] max-w-full rounded-sm bg-white object-contain shadow-card"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
                  />
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-line bg-paper-soft shadow-card">
            <div className="border-b border-line px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Extracted text
                </p>
                <div className="flex items-center gap-1.5">
                  {selectedPage && (
                    <Badge variant={selectedPage.ocr_used ? "gold" : "forest"}>
                      {selectedPage.ocr_used ? (
                        <>
                          <ScanLine className="size-3" /> OCR
                          {selectedPage.ocr_confidence
                            ? ` · ${selectedPage.ocr_confidence.toFixed(1)}%`
                            : ""}
                        </>
                      ) : (
                        <>
                          <Check className="size-3" /> Text layer
                        </>
                      )}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => void copyPage()}
                    className="grid size-7 place-items-center rounded-full text-ink-muted transition hover:bg-paper-deep hover:text-ink"
                    aria-label="Copy page text"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </div>

              <div className="relative mt-2.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search this page"
                  aria-label="Search the extracted page text"
                  className="h-9 w-full rounded-full border border-line bg-paper pl-9 pr-20 text-xs text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-accent/50"
                />
                {query && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ink-muted">
                    {matchCount} match{matchCount === 1 ? "" : "es"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
              {result.pages.map((page) => (
                <button
                  key={page.page_number}
                  type="button"
                  onClick={() => setPageNumber(page.page_number)}
                  className={cn(
                    "relative grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-medium transition-colors",
                    page.page_number === pageNumber
                      ? "bg-ink text-paper"
                      : "text-ink-muted hover:bg-paper-deep hover:text-ink",
                  )}
                  aria-label={`Page ${page.page_number}${pagesWithMatches.has(page.page_number) ? ", contains a match" : ""}`}
                >
                  {page.page_number}
                  {pagesWithMatches.has(page.page_number) && (
                    <span className="absolute right-1 top-1 size-1 rounded-full bg-gold" />
                  )}
                </button>
              ))}
            </div>

            <div className="max-h-[64vh] overflow-y-auto px-5 py-5">
              {selectedPage?.text ? (
                <div className="whitespace-pre-wrap font-serif text-[15px] leading-[1.75] text-ink">
                  {highlight(selectedPage.text, query)}
                </div>
              ) : (
                <div className="py-14 text-center">
                  <CircleAlert className="mx-auto size-5 text-gold" />
                  <p className="mt-3 text-sm font-medium text-ink">No text on this page.</p>
                  <p className="mx-auto mt-1 max-w-[260px] text-xs leading-relaxed text-ink-muted">
                    OCR may be unavailable for this language, or the page may be blank. Check the
                    processing diagnostics above.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[10px] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3 text-forest-light" /> Processed on your Ghost Reader
                server
              </span>
              <span>{selectedPage?.text.length.toLocaleString() ?? 0} characters</span>
            </div>
          </section>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3">
          <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            <ShieldCheck className="size-3.5 text-forest-light" />
            Temporary session · expires {formatDateTime(job.expires_at)}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <a href={fileUrl} download={result.file_name}>
                <Download className="size-3.5" /> Download
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/documents">
                New document <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[95] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper shadow-lift"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
