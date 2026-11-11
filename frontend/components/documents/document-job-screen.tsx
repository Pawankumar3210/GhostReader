"use client";

import {
  ArrowLeft,
  CircleAlert,
  FileScan,
  FileText,
  Loader2,
  RefreshCw,
  ScanLine,
} from "lucide-react";
import Link from "next/link";

import { DocumentViewer } from "@/components/documents/document-viewer";
import { Button } from "@/components/ui/button";
import { useDocumentJob } from "@/hooks/use-document-job";

const stages = [
  { label: "Validate the upload", detail: "File type, signature and size limits" },
  { label: "Inspect the document", detail: "Pages, text layers and embedded metadata" },
  { label: "Preserve text / render pages", detail: "Selectable text is kept exactly as authored" },
  { label: "Run OCR where needed", detail: "Tesseract with explicit language diagnostics" },
  { label: "Assemble the reading record", detail: "Per-page provenance, confidence and warnings" },
];

export function DocumentJobScreen({ jobId }: { jobId: string }) {
  const { job, error, loading, retry } = useDocumentJob(jobId);

  if (job?.status === "SUCCEEDED" && job.result) {
    return <DocumentViewer job={job} result={job.result} />;
  }

  const activeStage = job
    ? Math.max(
        0,
        stages.findIndex((stage) => {
          const current = job.stage.toLowerCase();
          if (stage.label.toLowerCase().includes("ocr")) return /ocr|scan/i.test(current);
          if (stage.label.toLowerCase().includes("inspect")) return /inspect|page/i.test(current);
          if (stage.label.toLowerCase().includes("preserve")) return /extract|text/i.test(current);
          if (stage.label.toLowerCase().includes("assemble"))
            return /assembl|final|complete/i.test(current);
          return /validat|prepar|upload/i.test(current);
        }),
      )
    : 0;

  const failed = job?.status === "FAILED" || job?.status === "CANCELLED" || Boolean(error);

  return (
    <div className="container-editorial py-12 md:py-16">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Documents
        </Link>

        <div className="mt-8 overflow-hidden rounded-[30px] border border-line bg-paper-soft p-7 shadow-card md:p-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow flex items-center gap-2">
                <span className="inline-block h-px w-6 bg-accent" /> Document session
              </p>
              <h1 className="mt-3 font-serif text-[clamp(1.9rem,4vw,2.7rem)] leading-tight text-ink">
                {failed ? "The document stalled." : "Reading your document."}
              </h1>
              {job?.result?.file_name && (
                <p className="mt-2 truncate text-xs text-ink-muted">{job.result.file_name}</p>
              )}
            </div>
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              {failed ? <CircleAlert className="size-6" /> : <FileScan className="size-6" />}
            </span>
          </div>

          {failed ? (
            <div className="mt-8 rounded-2xl border border-accent/25 bg-accent-soft/50 p-5">
              <p className="text-sm font-medium text-ink">
                {error?.message ?? job?.error?.message ?? "The document could not be processed."}
              </p>
              {(error?.code ?? job?.error?.code) && (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-dark/70">
                  {error?.code ?? job?.error?.code}
                </p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                Encrypted PDFs, unsupported encodings and files above the page or size limit are
                rejected rather than partially guessed.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {error && (
                  <Button variant="outline" size="sm" onClick={retry}>
                    <RefreshCw className="size-3.5" /> Reconnect
                  </Button>
                )}
                <Button asChild size="sm">
                  <Link href="/documents">Upload another document</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-8">
                <div className="flex items-center justify-between text-[11px] font-medium text-ink-muted">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin text-accent" />
                    {job?.stage ?? (loading ? "Starting document processing" : "Waiting")}
                  </span>
                  <span className="font-mono">{Math.round((job?.progress ?? 0.02) * 100)}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/60">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-700"
                    style={{ width: `${Math.max(4, (job?.progress ?? 0.02) * 100)}%` }}
                  />
                </div>
              </div>

              <ol className="mt-8">
                {stages.map((stage, index) => {
                  const complete = index < activeStage;
                  const active = index === activeStage;
                  return (
                    <li key={stage.label} className="relative flex gap-4 pb-6 last:pb-0">
                      {index < stages.length - 1 && (
                        <span
                          className={`absolute left-[13px] top-7 h-full w-px ${
                            complete ? "bg-forest/40" : "bg-line"
                          }`}
                        />
                      )}
                      <span
                        className={`relative z-10 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border text-[10px] font-semibold ${
                          complete
                            ? "border-forest bg-forest text-white"
                            : active
                              ? "border-accent bg-accent-soft text-accent"
                              : "border-line bg-paper text-ink-muted"
                        }`}
                      >
                        {complete ? (
                          <FileText className="size-3" />
                        ) : active ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <div className="pt-0.5">
                        <p
                          className={`text-sm font-medium ${
                            active ? "text-ink" : complete ? "text-ink-soft" : "text-ink-muted/70"
                          }`}
                        >
                          {stage.label}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                          {stage.detail}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <p className="mt-2 flex items-center gap-2 border-t border-line pt-4 text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                <ScanLine className="size-3" /> Pages with text layers skip OCR entirely
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
