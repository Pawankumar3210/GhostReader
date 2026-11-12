import type { Metadata } from "next";

import { RecentHost } from "@/components/reader/recent-host";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function RecentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecentHost id={id} />;
}
