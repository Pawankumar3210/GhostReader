"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { GhostMark } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Ghost Reader surface error", error);
  }, [error]);

  return (
    <div className="relative grid min-h-[70vh] place-items-center overflow-hidden px-6 py-20">
      <GhostMark
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[480px] -translate-x-1/2 -translate-y-1/2 text-accent/[0.04]"
      />
      <div className="relative max-w-lg text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <CircleAlert className="size-5" />
        </span>
        <h1 className="mt-5 font-serif text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.02] text-ink">
          The edition slipped.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
          Something unexpected interrupted this page. No reading data was sent anywhere. You can try
          the surface again or return to the desk.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
            ref {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw className="size-4" /> Try again
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
