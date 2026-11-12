import type { Metadata } from "next";

import { NewspaperHost } from "@/components/reader/newspaper-host";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function NewspaperPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <NewspaperHost jobId={jobId} />;
}
