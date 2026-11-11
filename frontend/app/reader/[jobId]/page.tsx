import type { Metadata } from "next";

import { ReaderHost } from "@/components/reader/reader-host";

export const metadata: Metadata = {
  title: "Reader",
  robots: { index: false, follow: false },
};

export default async function ReaderPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <ReaderHost jobId={jobId} />;
}
