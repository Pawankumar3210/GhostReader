"use client";

import { ArrowLeft, CircleAlert, Loader2 } from "lucide-react";
import Link from "next/link";

import { ReaderView } from "@/components/reader/reader-view";
import { Button } from "@/components/ui/button";
import { useAnalysisJob } from "@/hooks/use-analysis-job";
import { demoArticle } from "@/lib/demo";

function ReaderLoading({ message }: { message: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft">
          <Loader2 className="size-6 animate-spin text-accent" />
        </span>
        <p className="mt-5 font-serif text-2xl text-ink">Preparing the edition</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{message}</p>
        <Button asChild variant="ghost" size="sm" className="mt-5">
          <Link href="/analyze">
            <ArrowLeft className="size-4" /> Back to analysis
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ReaderError({ message }: { message: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft">
          <CircleAlert className="size-6 text-accent" />
        </span>
        <p className="mt-5 font-serif text-2xl text-ink">This edition is not available.</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <Link href="/analyze">Analyze a page</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/library">Open library</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function JobReader({ jobId }: { jobId: string }) {
  const { job, error, loading } = useAnalysisJob(jobId);

  if (loading && !job)
    return <ReaderLoading message="Fetching the latest stage of this analysis." />;
  if (error) return <ReaderError message={error.message} />;
  if (!job) return <ReaderLoading message="Waiting for the analysis service." />;
  if (job.status === "FAILED" || job.status === "CANCELLED") {
    return (
      <ReaderError
        message={job.error?.message ?? "The analysis ended before an edition could be built."}
      />
    );
  }
  if (job.status !== "SUCCEEDED" || !job.result) {
    return (
      <ReaderLoading
        message={`Still working: ${job.stage.toLowerCase()}. This page updates automatically.`}
      />
    );
  }

  return (
    <ReaderView result={job.result} sourceJobId={job.job_id} backHref="/analyze" backLabel="Back" />
  );
}

export function ReaderHost({ jobId }: { jobId: string }) {
  if (jobId === "demo") {
    return (
      <ReaderView result={demoArticle} sourceJobId="demo" backHref="/" backLabel="Home" demo />
    );
  }
  return <JobReader jobId={jobId} />;
}
