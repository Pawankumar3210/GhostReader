"use client";

import { CircleAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ReaderView } from "@/components/reader/reader-view";
import { Button } from "@/components/ui/button";
import { listRecents, type RecentAnalysis } from "@/lib/library-db";

export function RecentHost({ id }: { id: string }) {
  const [recent, setRecent] = useState<RecentAnalysis | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    listRecents()
      .then((items) => {
        if (active) setRecent(items.find((item) => item.id === id) ?? null);
      })
      .catch(() => {
        if (active) setRecent(null);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (recent === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <Loader2 className="size-6 animate-spin text-accent" />
      </div>
    );
  }

  if (recent === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper px-6 text-center">
        <div>
          <CircleAlert className="mx-auto size-7 text-accent" />
          <p className="mt-4 font-serif text-2xl text-ink">This edition has left the desk.</p>
          <p className="mt-2 text-sm text-ink-muted">
            Recent editions are stored only in this browser. It may have been cleared.
          </p>
          <Button asChild className="mt-5">
            <Link href="/analyze">Analyze a page</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ReaderView result={recent.result} backHref="/analyze" backLabel="Analysis" demo={false} />
  );
}
