"use client";

import { ArrowUpRight, Clock3, Trash2 } from "lucide-react";
import Link from "next/link";

import { useLibrary } from "@/components/providers/library-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEditionLength, hostname, relativeTime } from "@/lib/utils";

export function RecentEditions({ limit = 4 }: { limit?: number }) {
  const { recents, ready, forgetRecent, unavailable } = useLibrary();

  if (!ready) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-line/70 p-3.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2.5 h-4 w-full" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (unavailable) {
    return (
      <p className="text-xs leading-relaxed text-ink-muted">
        Recent editions are unavailable because this browser blocks local storage.
      </p>
    );
  }

  if (recents.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-ink-muted">
        Nothing here yet. Your last analyses will appear here, stored only in this browser.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {recents.slice(0, limit).map((recent) => (
        <div key={recent.id} className="group relative">
          <Link
            href={`/recent/${recent.id}`}
            className="block rounded-xl border border-transparent p-3 pr-9 transition-colors hover:border-line hover:bg-paper-deep/30"
          >
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              <span className="size-1 rounded-full bg-accent" />
              {recent.result.publisher ?? hostname(recent.result.source_url)}
              <span className="ml-auto normal-case tracking-normal opacity-70">
                {relativeTime(recent.openedAt)}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 font-serif text-[15px] leading-snug text-ink">
              {recent.result.title ?? "Untitled edition"}
            </p>
            <p className="mt-1 flex items-center gap-2 text-[10px] text-ink-muted">
              <Clock3 className="size-3" /> {formatEditionLength(recent.result)}
              <ArrowUpRight className="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-60" />
            </p>
          </Link>
          <button
            type="button"
            aria-label="Remove from recent editions"
            onClick={() => void forgetRecent(recent.id)}
            className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full text-ink-muted opacity-0 transition hover:bg-paper-deep hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
