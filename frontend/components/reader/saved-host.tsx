"use client";

import { CircleAlert, Loader2 } from "lucide-react";
import Link from "next/link";

import { useLibrary } from "@/components/providers/library-provider";
import { ReaderView } from "@/components/reader/reader-view";
import { Button } from "@/components/ui/button";

export function SavedReaderHost({ id }: { id: string }) {
  const { saved, ready, unavailable } = useLibrary();

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <Loader2 className="size-6 animate-spin text-accent" />
      </div>
    );
  }

  const article = saved.find((entry) => entry.id === id);

  if (!article) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper px-6 text-center">
        <div>
          <CircleAlert className="mx-auto size-7 text-accent" />
          <p className="mt-4 font-serif text-2xl text-ink">
            {unavailable ? "Local library unavailable" : "This edition is not in your library."}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
            {unavailable
              ? "This browser is blocking IndexedDB. Saved editions cannot be read here."
              : "It may have been removed, or it was saved in a different browser profile."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild>
              <Link href="/library">Open library</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/analyze">Analyze a page</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <ReaderView result={article.result} backHref="/library" backLabel="Library" />;
}
