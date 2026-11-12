import type { Metadata } from "next";

import { DocumentJobScreen } from "@/components/documents/document-job-screen";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DocumentJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <DocumentJobScreen jobId={jobId} />;
}
