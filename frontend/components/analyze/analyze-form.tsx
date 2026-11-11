"use client";

import * as Switch from "@radix-ui/react-switch";
import { AlertCircle, ArrowRight, Globe2, LockKeyhole, Sparkles, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api";
import { cn, isValidWebUrl, normaliseInputUrl } from "@/lib/utils";

export function AnalyzeForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [preferBrowser, setPreferBrowser] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [fieldInvalid, setFieldInvalid] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isValidWebUrl(url)) {
      setFieldInvalid(true);
      setError({ message: "Enter a valid public http or https address.", code: "INVALID_URL" });
      return;
    }
    setFieldInvalid(false);
    setPending(true);
    try {
      const job = await api.analyze(normaliseInputUrl(url), preferBrowser);
      router.push(`/analyze/${job.job_id}`);
    } catch (cause) {
      const apiError = cause instanceof ApiError ? cause : null;
      setError({
        message: apiError?.message ?? "The analysis could not be started. Try again.",
        code: apiError?.code,
      });
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative">
      <div className="flex items-center justify-between">
        <label htmlFor="analysis-url" className="eyebrow">
          Public page address
        </label>
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-muted">
          <LockKeyhole className="size-3" /> HTTPS preferred
        </span>
      </div>

      <div
        className={cn(
          "mt-3 flex items-center gap-2 rounded-2xl border bg-paper p-2 shadow-inset transition-colors",
          fieldInvalid ? "border-accent/60 ring-4 ring-accent/10" : "border-line",
        )}
      >
        <Globe2 className="ml-3 size-5 shrink-0 text-ink-muted" />
        <Input
          id="analysis-url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setFieldInvalid(false);
            setError(null);
          }}
          placeholder="https://publisher.example/article"
          inputMode="url"
          autoComplete="url"
          autoFocus
          aria-invalid={fieldInvalid}
          aria-describedby="analysis-url-note"
          className="h-12 border-0 bg-transparent px-1 text-[16px] shadow-none focus:ring-0"
          disabled={pending}
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-line/80 bg-paper-deep/30 px-4 py-3">
        <div className="min-w-0">
          <label
            htmlFor="prefer-browser"
            className="flex items-center gap-2 text-[13px] font-medium text-ink"
          >
            <Wand2 className="size-3.5 text-accent" />
            Prefer a rendered page
          </label>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
            Ask for an isolated browser fallback when static extraction is incomplete. Used only if
            the server has it enabled.
          </p>
        </div>
        <Switch.Root
          id="prefer-browser"
          checked={preferBrowser}
          onCheckedChange={setPreferBrowser}
          disabled={pending}
          className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors data-[state=checked]:bg-accent"
        >
          <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-200 data-[state=checked]:translate-x-[22px]" />
        </Switch.Root>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-accent/25 bg-accent-soft/50 px-4 py-3 text-sm text-accent-dark"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>{error.message}</p>
            {error.code && (
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] opacity-60">
                {error.code}
              </p>
            )}
          </div>
        </div>
      )}

      <Button type="submit" size="lg" disabled={pending} className="mt-6 w-full sm:w-auto">
        {pending ? <Spinner /> : <Sparkles className="size-4" />}
        {pending ? "Starting analysis…" : "Build the edition"}
        {!pending && <ArrowRight className="size-4" />}
      </Button>

      <p id="analysis-url-note" className="mt-4 text-[11px] leading-relaxed text-ink-muted">
        Public pages only. Ghost Reader respects robots.txt, publisher logins and paywalls, and
        never collects credentials or session cookies.
      </p>
    </form>
  );
}
