"use client";

import { ArrowRight, Link2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api";
import { isValidWebUrl, normaliseInputUrl } from "@/lib/utils";

export function QuickAnalyze() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isValidWebUrl(url)) {
      setError("Enter a public http or https page address.");
      return;
    }
    setPending(true);
    try {
      const job = await api.analyze(normaliseInputUrl(url));
      router.push(`/analyze/${job.job_id}`);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "The page could not be queued. Try again.",
      );
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-[560px]">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-2 rounded-[26px] border border-line/90 bg-paper-soft p-2 shadow-card sm:flex-row sm:items-center sm:rounded-full"
      >
        <div className="relative flex-1">
          <Link2
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 size-[17px] -translate-y-1/2 text-ink-muted"
          />
          <label htmlFor="hero-url" className="sr-only">
            Public page address
          </label>
          <Input
            id="hero-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="Paste a public link — or try ghostreader.app/demo"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="h-12 border-0 bg-transparent pl-11 pr-2 shadow-none focus:ring-0"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "hero-url-error" : "hero-url-hint"}
          />
        </div>
        <Button type="submit" size="md" disabled={pending} className="shrink-0 sm:h-11">
          {pending ? <Spinner /> : null}
          {pending ? "Opening…" : "Open edition"}
          {!pending && <ArrowRight className="size-4" />}
        </Button>
      </form>
      <div className="mt-3 flex min-h-5 items-start gap-2 px-2 text-xs">
        {error ? (
          <p id="hero-url-error" role="alert" className="text-accent-dark">
            {error}
          </p>
        ) : (
          <p id="hero-url-hint" className="flex items-center gap-2 text-ink-muted">
            <ShieldCheck className="size-3.5 text-forest-light" />
            Public pages only. Robots.txt respected. No login or paywall bypass.
          </p>
        )}
      </div>
    </div>
  );
}
