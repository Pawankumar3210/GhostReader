import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";

import { GhostMark } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative grid min-h-[70vh] place-items-center overflow-hidden px-6 py-20">
      <GhostMark
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 text-accent/[0.04]"
      />
      <div className="relative max-w-lg text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Page 404</p>
        <h1 className="mt-4 font-serif text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.98] tracking-[-0.035em] text-ink">
          This page has gone
          <span className="block italic text-accent">quiet.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-ink-soft">
          The address may be mistyped, expired, or the edition may have been temporary. The reading
          room is still open.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/">
              <ArrowLeft className="size-4" /> Back home
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/analyze">
              <Search className="size-4" /> Analyze a page
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
