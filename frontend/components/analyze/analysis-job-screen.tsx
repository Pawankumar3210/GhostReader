"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  Newspaper,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AccessBadge } from "@/components/reader/access-badge";
import { GhostMark } from "@/components/layout/logo";
import { useLibrary } from "@/components/providers/library-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useAnalysisJob } from "@/hooks/use-analysis-job";
import { hostname, newspaperPageCount } from "@/lib/utils";

const timeline = [
  {
    label: "Validate the destination",
    detail: "Scheme, port, DNS and private-network protections",
    match: /validat/i,
  },
  {
    label: "Read the publisher's policy",
    detail: "robots.txt and access signals are checked before extraction",
    match: /policy|robots/i,
  },
  {
    label: "Fetch the public page",
    detail: "Bounded redirects, byte limits and content-type validation",
    match: /fetch/i,
  },
  {
    label: "Extract the edition",
    detail: "Metadata, article structure, images and reading measures",
    match: /extract/i,
  },
  {
    label: "Assess access & provenance",
    detail: "Access status, evidence and safety notes are attached",
    match: /final|assess/i,
  },
];

export function AnalysisJobScreen({ jobId }: { jobId: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { job, error, retry, remove } = useAnalysisJob(jobId);
  const { save, remove: removeSaved, saved, unavailable, remember } = useLibrary();
  const [cancelling, setCancelling] = useState(false);
  const remembered = useRef<string | null>(null);

  const savedArticle = job?.result
    ? saved.find((article) => article.result.source_url === job.result?.source_url)
    : undefined;

  useEffect(() => {
    if (job?.status === "SUCCEEDED" && job.result && remembered.current !== job.job_id) {
      remembered.current = job.job_id;
      void remember(job.result);
    }
  }, [job, remember]);

  const activeStage = job
    ? Math.max(
        0,
        timeline.findIndex((stage) => stage.match.test(job.stage)),
      )
    : 0;
  const succeeded = job?.status === "SUCCEEDED" && job.result;
  const failed = job?.status === "FAILED" || job?.status === "CANCELLED" || Boolean(error);

  async function cancel() {
    setCancelling(true);
    try {
      await remove();
    } catch {
      // The job may already have expired; leave the screen regardless.
    }
    router.push("/analyze");
  }

  async function toggleSave() {
    if (!job?.result) return;
    if (savedArticle) {
      await removeSaved(savedArticle.id);
    } else {
      await save(job.result);
    }
  }

  if (succeeded && job.result) {
    const result = job.result;
    const pageCount = newspaperPageCount(result);
    return (
      <div className="container-editorial py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" /> Analyze another page
          </Link>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mt-8"
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-forest">
              <span className="grid size-6 place-items-center rounded-full bg-forest-soft">
                <Check className="size-3.5" />
              </span>
              Edition ready
            </div>

            <div className="relative mt-6 overflow-hidden rounded-[30px] border border-line bg-paper-soft p-7 shadow-card md:p-10">
              <GhostMark
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 size-64 text-accent/[0.05]"
              />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  <AccessBadge status={result.access_status} />
                  <Badge>{result.content_type.replaceAll("_", " ")}</Badge>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                    {hostname(result.source_url)}
                  </span>
                </div>

                <h1 className="mt-5 font-serif text-[clamp(2rem,4.5vw,3.3rem)] leading-[1.02] tracking-[-0.03em] text-ink">
                  {result.title ?? "This page could not be titled"}
                </h1>
                {result.subtitle && (
                  <p className="mt-3 font-serif text-lg italic text-ink-soft">{result.subtitle}</p>
                )}
                {result.description && (
                  <p className="mt-4 line-clamp-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
                    {result.description}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-ink-muted">
                  {result.author && <span>By {result.author}</span>}
                  <span className="inline-flex items-center gap-1.5">
                    {pageCount > 0 ? (
                      <>
                        <Newspaper className="size-3.5" /> {pageCount}{" "}
                        {pageCount === 1 ? "page" : "pages"}
                      </>
                    ) : (
                      <>
                        <Clock3 className="size-3.5" /> {result.reading_time_minutes} min
                      </>
                    )}
                  </span>
                  {pageCount === 0 && <span>{result.word_count.toLocaleString()} words</span>}
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5" /> {result.access_assessment.confidence}{" "}
                    confidence
                  </span>
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link href={`/reader/${job.job_id}`}>
                      Open reader <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href={`/newspaper/${job.job_id}`}>
                      <Newspaper className="size-4" /> Newspaper
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={toggleSave}
                    disabled={unavailable}
                    title={unavailable ? "Local storage is unavailable" : undefined}
                  >
                    {savedArticle ? (
                      <BookmarkCheck className="size-4" />
                    ) : (
                      <Bookmark className="size-4" />
                    )}
                    {savedArticle ? "In your library" : "Save edition"}
                  </Button>
                  <Button asChild variant="ghost" size="lg">
                    <a href={result.source_url} target="_blank" rel="noreferrer noopener">
                      Original <ExternalLink className="size-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <details className="group mt-5 rounded-2xl border border-line bg-paper p-5 text-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <Sparkles className="size-4 text-accent" /> What Ghost Reader found
                </span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                  Access report
                </span>
              </summary>
              <div className="mt-4 space-y-3 border-t border-line pt-4">
                <p className="leading-relaxed text-ink-soft">
                  {result.access_assessment.explanation}
                </p>
                <ul className="space-y-2">
                  {result.access_assessment.evidence.map((item, index) => (
                    <li key={index} className="flex gap-2 text-xs leading-relaxed text-ink-muted">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
                {result.notes.length > 0 && (
                  <ul className="space-y-1.5 border-t border-line pt-3 text-xs text-ink-muted">
                    {result.notes.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-editorial py-12 md:py-16">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/analyze"
          className="inline-flex items-center gap-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back to analysis
        </Link>

        <div className="relative mt-8 overflow-hidden rounded-[30px] border border-line bg-paper-soft p-7 shadow-card md:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,rgb(var(--gr-accent)/0.08),transparent_70%)]"
          />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow flex items-center gap-2">
                  <span className="inline-block h-px w-6 bg-accent" /> Live analysis
                </p>
                <h1 className="mt-3 font-serif text-[clamp(1.9rem,4vw,2.8rem)] leading-tight text-ink">
                  {failed ? "The page resisted." : "Building your edition."}
                </h1>
              </div>
              <div className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-accent text-white">
                <GhostMark className="size-9" detailClassName="text-[#2a130d]" aria-hidden />
                {!failed && (
                  <span className="absolute inset-0 animate-ping rounded-2xl border border-accent/30" />
                )}
              </div>
            </div>

            {failed ? (
              <FailurePanel
                message={
                  error?.message ??
                  job?.error?.message ??
                  "The page could not be turned into an edition."
                }
                code={error?.code ?? job?.error?.code}
                notFound={error?.status === 404}
                onRetry={error ? retry : undefined}
                onCancel={cancel}
                cancelling={cancelling}
              />
            ) : (
              <>
                <div className="mt-8">
                  <div className="flex items-center justify-between text-[11px] font-medium text-ink-muted">
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="size-3.5 text-accent" />
                      {job?.stage ?? "Starting analysis"}
                    </span>
                    <span className="font-mono">{Math.round((job?.progress ?? 0.02) * 100)}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/60">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: "2%" }}
                      animate={{ width: `${Math.max(4, (job?.progress ?? 0.02) * 100)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>

                <ol className="mt-8 space-y-0">
                  {timeline.map((stage, index) => {
                    const complete = index < activeStage;
                    const active = index === activeStage;
                    return (
                      <li key={stage.label} className="relative flex gap-4 pb-6 last:pb-0">
                        {index < timeline.length - 1 && (
                          <span
                            aria-hidden
                            className={`absolute left-[13px] top-7 h-full w-px ${
                              complete ? "bg-forest/40" : "bg-line"
                            }`}
                          />
                        )}
                        <span
                          className={`relative z-10 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border text-[10px] font-semibold transition-colors ${
                            complete
                              ? "border-forest bg-forest text-white"
                              : active
                                ? "border-accent bg-accent-soft text-accent"
                                : "border-line bg-paper text-ink-muted"
                          }`}
                        >
                          {complete ? (
                            <Check className="size-3.5" />
                          ) : active ? (
                            <Spinner className="size-3" />
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

                <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                  <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                    <Clock3 className="size-3" /> Jobs expire automatically
                  </p>
                  <button
                    type="button"
                    onClick={cancel}
                    disabled={cancelling}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-accent"
                  >
                    <X className="size-3.5" /> {cancelling ? "Cancelling…" : "Cancel"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-muted">
          Ghost Reader only retrieves publicly accessible content. It does not bypass logins,
          paywalls or access challenges.
        </p>
      </div>
    </div>
  );
}

function FailurePanel({
  message,
  code,
  notFound,
  onRetry,
  onCancel,
  cancelling,
}: {
  message: string;
  code?: string;
  notFound?: boolean;
  onRetry?: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 rounded-2xl border border-accent/25 bg-accent-soft/50 p-5"
      >
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-medium text-ink">{message}</p>
            {code && (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-dark/70">
                {code}
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              {notFound
                ? "This analysis has expired or was removed. Temporary results are kept briefly for privacy."
                : "Access-protected pages are reported, never circumvented. You can check the original page or try a different public link."}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {onRetry && !notFound && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="size-3.5" /> Reconnect
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href="/analyze">Analyze another page</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={cancelling}>
            Dismiss
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
