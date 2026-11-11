"use client";

import { ArrowLeft, CircleAlert, Loader2 } from "lucide-react";
import Link from "next/link";

import { NewspaperView } from "@/components/reader/newspaper-view";
import { Button } from "@/components/ui/button";
import { useAnalysisJob } from "@/hooks/use-analysis-job";
import { demoArticle } from "@/lib/demo";

function NewspaperStatus({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="max-w-sm text-center">
        {error ? (
          <CircleAlert className="mx-auto size-7 text-accent" />
        ) : (
          <Loader2 className="mx-auto size-7 animate-spin text-accent" />
        )}
        <p className="mt-4 font-serif text-2xl text-ink">
          {error ? "The press is stopped." : "Setting the type."}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{message}</p>
        <Button asChild variant="ghost" size="sm" className="mt-5">
          <Link href="/analyze">
            <ArrowLeft className="size-4" /> Back
          </Link>
        </Button>
      </div>
    </div>
  );
}

function JobNewspaper({ jobId }: { jobId: string }) {
  const { job, error, loading } = useAnalysisJob(jobId);
  if (loading && !job) return <NewspaperStatus message="Waiting for the edition." />;
  if (error) return <NewspaperStatus message={error.message} error />;
  if (!job) return <NewspaperStatus message="Waiting for the analysis service." />;
  if (job.status === "FAILED" || job.status === "CANCELLED") {
    return (
      <NewspaperStatus message={job.error?.message ?? "The edition could not be prepared."} error />
    );
  }
  if (job.status !== "SUCCEEDED" || !job.result) {
    return <NewspaperStatus message={`Still preparing: ${job.stage.toLowerCase()}.`} />;
  }
  return <NewspaperView result={job.result} sourceJobId={jobId} />;
}

export function NewspaperHost({ jobId }: { jobId: string }) {
  if (jobId === "demo") {
    return <NewspaperView result={demoArticle} sourceJobId="demo" demo />;
  }
  return <JobNewspaper jobId={jobId} />;
}
