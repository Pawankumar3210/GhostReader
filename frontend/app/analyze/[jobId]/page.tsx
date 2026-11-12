import type { Metadata } from "next";

import { AnalysisJobScreen } from "@/components/analyze/analysis-job-screen";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AnalysisJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <AnalysisJobScreen jobId={jobId} />;
}
