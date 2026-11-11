"use client";

import {
  ArrowRight,
  Check,
  FileImage,
  FileText,
  Languages,
  ScanLine,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api";
import { cn, formatBytes } from "@/lib/utils";

const ACCEPTED = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"];
const MAX_BYTES = 40_000_000;

interface OcrState {
  checked: boolean;
  available: boolean;
  kannada: boolean;
  english: boolean;
  message: string | null;
}

export function DocumentWorkspace() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [languages, setLanguages] = useState<string[]>(["eng", "kan"]);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrState>({
    checked: false,
    available: true,
    kannada: true,
    english: true,
    message: null,
  });

  useEffect(() => {
    api
      .health()
      .then((report) => {
        const checks = report.checks as {
          ocr?: {
            ok?: boolean;
            english_available?: boolean;
            kannada_available?: boolean;
            message?: string | null;
          };
        };
        setOcr({
          checked: true,
          available: Boolean(checks.ocr?.ok),
          kannada: Boolean(checks.ocr?.kannada_available),
          english: Boolean(checks.ocr?.english_available),
          message: checks.ocr?.message ?? null,
        });
      })
      .catch(() => setOcr((current) => ({ ...current, checked: true })));
  }, []);

  function chooseFile(candidate: File | null) {
    setError(null);
    if (!candidate) return;
    const extension = candidate.name.toLowerCase().slice(candidate.name.lastIndexOf("."));
    if (!ACCEPTED.includes(extension)) {
      setError("Choose a PDF, PNG, JPG, WEBP or GIF file.");
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setError(`This file is ${formatBytes(candidate.size)}. The limit is 40 MB.`);
      return;
    }
    if (candidate.size === 0) {
      setError("This file is empty.");
      return;
    }
    setFile(candidate);
  }

  function toggleLanguage(code: string) {
    setLanguages((current) => {
      if (current.includes(code)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== code);
      }
      return [...current, code];
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a document first.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const job = await api.uploadDocument(file, languages);
      router.push(`/documents/${job.job_id}`);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "The document could not be uploaded. Try again.",
      );
      setPending(false);
    }
  }

  const isImage = file ? /\.(png|jpe?g|webp|gif)$/i.test(file.name) : false;

  return (
    <form onSubmit={onSubmit}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          chooseFile(event.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          "relative flex min-h-[260px] flex-col items-center justify-center rounded-[24px] border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging
            ? "border-accent bg-accent-soft/40"
            : "border-line bg-paper hover:border-accent/40 hover:bg-paper-soft",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
        />

        {file ? (
          <div className="w-full max-w-sm">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
              {isImage ? <FileImage className="size-6" /> : <FileText className="size-6" />}
            </span>
            <p className="mt-4 truncate font-medium text-ink">{file.name}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {formatBytes(file.size)} · {isImage ? "Image document" : "PDF document"}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                <X className="size-3.5" /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <>
            <span className="grid size-14 place-items-center rounded-2xl bg-paper-deep text-accent">
              <UploadCloud className="size-6" />
            </span>
            <p className="mt-4 font-serif text-xl text-ink">Drop a document here</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-ink-muted">
              PDF, PNG, JPG, WEBP or GIF — up to 40 MB and 80 PDF pages.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-5"
              onClick={() => inputRef.current?.click()}
            >
              Browse files
            </Button>
          </>
        )}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-medium text-ink">
            <Languages className="size-3.5 text-accent" /> OCR languages
          </p>
          <span className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            Tesseract models
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {[
            { code: "eng", label: "English", available: ocr.english },
            { code: "kan", label: "Kannada", available: ocr.kannada },
          ].map((language) => {
            const active = languages.includes(language.code);
            return (
              <button
                key={language.code}
                type="button"
                onClick={() => toggleLanguage(language.code)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "border-forest bg-forest-soft text-forest"
                    : "border-line text-ink-muted hover:border-ink/30 hover:text-ink",
                )}
                aria-pressed={active}
              >
                <span
                  className={cn(
                    "grid size-3.5 place-items-center rounded-full border",
                    active ? "border-forest bg-forest text-white" : "border-ink-muted/40",
                  )}
                >
                  {active && <Check className="size-2.5" />}
                </span>
                {language.label}
                {ocr.checked && !language.available && (
                  <span className="text-[9px] uppercase tracking-[0.08em] text-accent">
                    missing
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-ink-muted">
          Embedded PDF text is always preserved. OCR is used only for pages without a text layer.
        </p>
      </div>

      {ocr.checked && !ocr.available && (
        <div className="mt-4 rounded-xl border border-gold/30 bg-gold-soft/50 px-4 py-3 text-xs leading-relaxed text-ink-soft">
          <strong className="font-semibold">OCR engine unavailable.</strong> Embedded PDF text will
          still be extracted, but scanned pages cannot be read.
          {ocr.message && (
            <span className="mt-1 block text-[10px] text-ink-muted">{ocr.message}</span>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-accent/25 bg-accent-soft/50 px-4 py-3 text-sm text-accent-dark"
        >
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <Button type="submit" size="lg" disabled={pending || !file} className="mt-6 w-full">
        {pending ? <Spinner /> : <ScanLine className="size-4" />}
        {pending ? "Uploading document…" : "Extract text"}
        {!pending && <ArrowRight className="size-4" />}
      </Button>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-muted">
        <ShieldCheck className="size-3 text-forest-light" />
        Temporary processing · auto-deleted after 30 minutes
      </p>
    </form>
  );
}
