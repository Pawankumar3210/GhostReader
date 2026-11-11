import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookMarked, CircleCheck, Globe2, ShieldCheck, Sparkles } from "lucide-react";

import { AnalyzeForm } from "@/components/analyze/analyze-form";
import { RecentEditions } from "@/components/analyze/recent-editions";
import { PageHeading } from "@/components/ui/page-heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Analyze a page",
  description:
    "Turn a publicly accessible article into a clean Ghost Reader edition. SSRF-hardened fetching, robots-aware, with evidence attached.",
};

const guarantees = [
  { icon: Globe2, text: "Public http and https pages only" },
  { icon: ShieldCheck, text: "Private networks and metadata IPs blocked" },
  { icon: CircleCheck, text: "Publisher access boundaries respected" },
];

export default function AnalyzePage() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]"
      />
      <div className="container-editorial relative py-12 md:py-16">
        <PageHeading
          eyebrow="The reading room"
          title={
            <>
              What are we <span className="italic text-accent">reading?</span>
            </>
          }
          description="Paste a public link. Ghost Reader will verify the destination, read the publisher's rules, extract the article and hand you a calmer edition — with its reasoning attached."
        />

        <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1.32fr_0.68fr]">
          <section className="rounded-[28px] border border-line bg-paper-soft p-6 shadow-card md:p-9">
            <AnalyzeForm />

            <div className="mt-8 grid gap-3 border-t border-line pt-6 sm:grid-cols-3">
              {guarantees.map((item) => (
                <div key={item.text} className="flex items-start gap-2.5">
                  <item.icon className="mt-0.5 size-3.5 shrink-0 text-forest-light" />
                  <p className="text-[11px] leading-relaxed text-ink-muted">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-line bg-paper-soft p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow flex items-center gap-2">
                  <BookMarked className="size-3.5 text-accent" /> Recent editions
                </p>
                <Link
                  href="/library"
                  className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-ink"
                >
                  Library
                </Link>
              </div>
              <div className="mt-3">
                <RecentEditions />
              </div>
              <p className="mt-3 border-t border-line/70 pt-3 text-[10px] leading-relaxed text-ink-muted">
                Stored in this browser only. No account, no sync, no reading graph.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-paper p-5">
              <p className="eyebrow">The reading contract</p>
              <ul className="mt-4 space-y-3">
                {[
                  "Robots.txt is checked before retrieval.",
                  "Paywalls and login walls are reported, never breached.",
                  "JSON-LD metadata is evidence, not article text.",
                  "Images are proxied through signed, expiring links.",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5 text-[11px] leading-relaxed text-ink-soft">
                    <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-forest-light" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-forest p-5 text-white">
              <Sparkles className="size-5 text-[#a9c9b4]" />
              <p className="mt-3 font-serif text-xl leading-tight">Want to see the reader first?</p>
              <p className="mt-2 text-xs leading-relaxed text-white/60">
                Open a bundled sample edition and try every typography control without fetching
                anything.
              </p>
              <Button asChild size="sm" className="mt-4 bg-white text-forest hover:bg-white/90">
                <Link href="/demo">
                  Sample edition <ArrowRight className="size-3.5" />
                </Link>
              </Button>
              <span className="pointer-events-none absolute -bottom-12 -right-10 size-36 rounded-full border border-white/10" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
