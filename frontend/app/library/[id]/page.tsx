import type { Metadata } from "next";

import { SavedReaderHost } from "@/components/reader/saved-host";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SavedReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SavedReaderHost id={id} />;
}
