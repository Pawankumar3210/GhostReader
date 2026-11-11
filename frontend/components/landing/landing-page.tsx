"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Columns2,
  FileScan,
  Fingerprint,
  Globe2,
  Library,
  LockKeyhole,
  Newspaper,
  Quote,
  ScanLine,
  ShieldCheck,
  Sun,
  Type,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { QuickAnalyze } from "@/components/analyze/quick-analyze";
import { GhostMark } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  copy,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  copy?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      <p className="eyebrow flex items-center gap-2">
        <span className="inline-block h-px w-7 bg-accent" />
        {eyebrow}
      </p>
      <h2 className="mt-4 text-display-sm text-ink">{title}</h2>
      {copy && <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{copy}</p>}
    </div>
  );
}

const stats = [
  { icon: ShieldCheck, title: "Robots-aware", copy: "Reads publisher rules first" },
  { icon: LockKeyhole, title: "SSRF-hardened", copy: "Every redirect re-validated" },
  { icon: FileScan, title: "Kannada + English", copy: "OCR that shows its confidence" },
  { icon: Library, title: "Local-first", copy: "Your library stays in your browser" },
];

const steps = [
  {
    number: "01",
    title: "Paste a public link",
    copy: "A personal reading tool, not a crawler. Ghost Reader checks the scheme, resolves DNS and refuses private, loopback and metadata addresses before a request is made.",
    detail: "http/https · ports 80/443 · public hosts only",
  },
  {
    number: "02",
    title: "Watch the evidence",
    copy: "The page is fetched safely, classified and assessed. You see whether the publisher offers full public content, a preview, a paywall or a login wall — with the evidence behind every verdict.",
    detail: "Access assessment · extraction confidence · provenance",
  },
  {
    number: "03",
    title: "Read it your way",
    copy: "Move between an unhurried reader, a broadsheet newspaper and a printable edition. Adjust type, measure and theme. Save the result to a local library that never leaves your device.",
    detail: "Reader · newspaper · print · offline library",
  },
];

const principles = [
  {
    icon: Fingerprint,
    title: "Consent by design",
    copy: "No paywall circumvention, no credential replay, no challenge solving. Access status is treated as a boundary, not an obstacle.",
  },
  {
    icon: ScanLine,
    title: "Evidence on the record",
    copy: "Access verdicts, extraction notes and OCR diagnostics travel with every edition. You can audit how a page became a page.",
  },
  {
    icon: Library,
    title: "Local by default",
    copy: "Saved editions live in IndexedDB in your browser. There is no account, no reading graph and no server-side library to breach.",
  },
];

export function LandingPage() {
  const reduce = useReducedMotion();

  return (
    <div className="overflow-hidden">
      <section className="relative pb-16 pt-8 md:pb-24 md:pt-14">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="fine-grid pointer-events-none absolute inset-0 opacity-70" />
        <GhostMark
          aria-hidden
          className="pointer-events-none absolute -right-20 top-24 size-[520px] text-accent/[0.045] md:right-[-4%]"
        />

        <div className="container-editorial relative grid items-center gap-16 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 font-serif text-display font-normal text-ink"
            >
              Read beyond
              <span className="relative mt-1 block italic text-accent">
                the noise.
                <svg
                  aria-hidden
                  viewBox="0 0 340 16"
                  className="absolute -bottom-3 left-0 h-3 w-[58%] text-accent/40"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 11c64-8 126-9 208-4 48 3 88 2 128-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </motion.h1>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mt-8 max-w-[500px] text-[16px] leading-relaxed text-ink-soft"
            >
              Ghost Reader distills publicly accessible pages and your own documents into calm,
              considered editions — reader view, broadsheet, print and OCR. Every decision is
              visible. Every boundary is respected.
            </motion.p>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24 }}
              className="mt-8"
            >
              <QuickAnalyze />
            </motion.div>

            <motion.div
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.35 }}
              className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted"
            >
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-forest-light" /> No account
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-forest-light" /> No tracking
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-forest-light" /> No paywall tricks
              </span>
              <Link
                href="/demo"
                className="link-underline inline-flex items-center gap-1 font-medium text-ink"
              >
                Read a sample edition <ArrowUpRight className="size-3" />
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 34, rotate: -1 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.9, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-[520px] lg:max-w-none"
          >
            <div
              aria-hidden
              className="absolute -left-8 -top-8 size-40 rounded-full border border-gold/30 bg-gold-soft/60 blur-[1px]"
            />
            <div
              aria-hidden
              className="absolute -bottom-10 right-0 size-56 rounded-full bg-forest/10 blur-3xl"
            />

            <div className="paper-texture relative -rotate-[1.2deg] rounded-[26px] border border-line bg-paper-soft p-6 shadow-[0_50px_90px_-50px_rgba(27,24,20,0.55)] transition-transform duration-700 hover:rotate-0 md:p-7">
              <div className="flex items-center justify-between border-b border-line pb-3.5">
                <span className="font-serif text-[15px] italic text-ink">The Sunday Edition</span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-ink-muted">
                  No. 042 · Ghost Reader
                </span>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="eyebrow">Field notes · 8 min read</p>
                <Badge variant="forest" className="px-2 py-0.5 text-[9px]">
                  Public · full text
                </Badge>
              </div>

              <h2 className="mt-3 font-serif text-[30px] font-normal leading-[1.06] tracking-[-0.025em] text-ink md:text-[34px]">
                The quiet architecture of attention
              </h2>
              <p className="mt-2 font-serif text-[13px] italic text-ink-muted">
                By Mira Sen · The Ghost Review
              </p>

              <div className="mt-5 grid grid-cols-[1.35fr_0.9fr] gap-5">
                <div className="text-[10.5px] leading-[1.7] text-ink-soft">
                  <p>
                    <span className="float-left mr-1.5 font-serif text-[36px] leading-[0.8] text-accent">
                      A
                    </span>
                    ttention is a place before it is a resource. We build rooms for it, then wonder
                    why the walls keep moving. A page can be generous or hostile; most are merely
                    loud.
                  </p>
                  <p className="mt-2.5">
                    To read well is to choose a boundary — a column, a measure, a moment that does
                    not ask to be shared. The quiet architecture begins there.
                  </p>
                  <p className="mt-2.5 text-ink-muted">
                    Extracted at 96% confidence. Images proxied. Access verified against the
                    publisher&apos;s own signals…
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-xl border border-line bg-paper-deep">
                  <Image
                    src="/hero-illustration.svg"
                    alt="An abstract reading landscape with an arch and layered hills"
                    width={400}
                    height={520}
                    className="h-full w-full object-cover"
                    priority
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/40 to-transparent p-2">
                    <p className="text-[8px] leading-tight text-white/85">
                      Illustration · The Ghost Review archive
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-line pt-3">
                <div className="flex items-center gap-2">
                  <div className="grid size-6 place-items-center rounded-full bg-accent/10">
                    <BookOpen className="size-3 text-accent" />
                  </div>
                  <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                    2,418 words · 8 min
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-forest-light" />
                  <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-forest">
                    Access verified
                  </span>
                </div>
              </div>
            </div>

            <motion.div
              animate={reduce ? undefined : { y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-3 top-[52%] hidden rotate-[3deg] items-start gap-2.5 rounded-2xl border border-line bg-paper-soft/95 p-3 shadow-lift backdrop-blur sm:flex"
            >
              <div className="grid size-7 place-items-center rounded-full bg-forest-soft">
                <ShieldCheck className="size-3.5 text-forest" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-ink">Publisher signals</p>
                <p className="mt-0.5 text-[9px] text-ink-muted">Public · no paywall detected</p>
              </div>
            </motion.div>

            <motion.div
              animate={reduce ? undefined : { y: [0, 7, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
              className="absolute -bottom-5 -left-4 hidden items-center gap-1 rounded-full border border-line bg-paper-soft/95 px-2.5 py-1.5 shadow-lift backdrop-blur sm:flex"
            >
              {[Type, Sun, Columns2].map((Icon, index) => (
                <span
                  key={index}
                  className={cn(
                    "grid size-7 place-items-center rounded-full",
                    index === 0 ? "bg-ink text-paper" : "text-ink-soft",
                  )}
                >
                  <Icon className="size-3" />
                </span>
              ))}
              <span className="mx-1 h-4 w-px bg-line" />
              <span className="pr-1 font-serif text-[13px] text-ink">Aa</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-line/80 bg-paper-soft/50">
        <div className="container-editorial grid grid-cols-2 divide-line/70 md:grid-cols-4 md:divide-x">
          {stats.map((stat, index) => (
            <Reveal
              key={stat.title}
              delay={index * 0.05}
              className={cn(
                "flex items-start gap-3 py-6 md:px-7",
                index > 1 && "border-t border-line/70 md:border-t-0",
                index % 2 === 1 && "border-l border-line/70 pl-4 md:border-l-0 md:pl-7",
              )}
            >
              <stat.icon className="mt-0.5 size-4 shrink-0 text-accent" />
              <div>
                <p className="text-[13px] font-semibold text-ink">{stat.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{stat.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container-editorial py-24 md:py-32">
        <Reveal>
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <SectionIntro
              eyebrow="Not another scraper"
              title={
                <>
                  The web, without
                  <br />
                  the <span className="italic text-accent">scrum.</span>
                </>
              }
            />
            <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
              One extraction engine, three ways to read. The interface gets out of the way; the
              evidence stays within reach.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-12">
          <Reveal className="md:col-span-7">
            <Card className="group relative h-full overflow-hidden p-0">
              <div className="p-7 md:p-9">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
                    <BookOpen className="size-4" />
                  </span>
                  <p className="eyebrow">Reader view</p>
                </div>
                <h3 className="mt-5 max-w-md font-serif text-[30px] leading-[1.08] text-ink">
                  A reader that respects the page.
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
                  Serif or sans, three paper tones, measure and type size. A column that behaves
                  like a printed page, not an infinite feed.
                </p>
              </div>

              <div className="mx-6 mb-6 rounded-2xl border border-line bg-paper p-4 shadow-inset md:mx-9 md:mb-9 md:p-6">
                <div className="flex items-center justify-between border-b border-line/80 pb-3">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                    Reading · paper
                  </span>
                  <div className="flex items-center gap-1.5 text-ink-muted">
                    <Type className="size-3" />
                    <span className="font-serif text-[13px] text-ink">Aa</span>
                    <span className="mx-1 h-3 w-px bg-line" />
                    <Sun className="size-3" />
                  </div>
                </div>
                <p className="mt-4 font-serif text-[10px] uppercase tracking-[0.2em] text-accent">
                  Essay
                </p>
                <h4 className="mt-2 font-serif text-[24px] leading-[1.1] text-ink">
                  The quiet architecture of attention
                </h4>
                <p className="mt-3 font-serif text-[12px] leading-[1.8] text-ink-soft">
                  <span className="float-left mr-1.5 font-serif text-[34px] leading-[0.78] text-accent">
                    A
                  </span>
                  ttention is a place before it is a resource. We build rooms for it, then wonder
                  why the walls keep moving. A page can be generous or hostile; most are merely
                  loud.
                </p>
                <div className="mt-4 flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-ink-muted">
                  <span className="h-px w-8 bg-accent/60" />
                  21px Newsreader · 68ch measure
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.08} className="md:col-span-5">
            <Card className="relative h-full overflow-hidden bg-forest p-7 text-white md:p-9">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-white">
                  <Newspaper className="size-4" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                  Newspaper view
                </p>
              </div>
              <h3 className="mt-5 font-serif text-[30px] leading-[1.08]">
                The Sunday edition,
                <br />
                on demand.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                A broadsheet layout with masthead, decks and columns — ready for a quiet screen or a
                clean print.
              </p>

              <div className="relative mt-7 -rotate-2 rounded-lg bg-[#f7f2e8] p-4 text-[#1e1a14] shadow-[0_30px_50px_-25px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:rotate-0">
                <div className="border-b-2 border-[#1e1a14] pb-1 text-center">
                  <p className="font-serif text-[20px] font-semibold tracking-[-0.03em]">
                    The Sunday Edition
                  </p>
                  <p className="mt-0.5 text-[6px] font-semibold uppercase tracking-[0.28em]">
                    The Ghost Review · No. 042
                  </p>
                </div>
                <div className="mt-2 flex gap-1.5 text-[5.5px] uppercase tracking-[0.12em] text-[#57493a]">
                  <span>Essay</span>
                  <span>·</span>
                  <span>8 min read</span>
                </div>
                <p className="mt-1 font-serif text-[17px] leading-[1.02]">
                  The quiet architecture of attention
                </p>
                <div className="mt-2 columns-2 gap-3 text-[6.5px] leading-[1.5] text-[#3f362b]">
                  <p>
                    Attention is a place before it is a resource. We build rooms for it, then wonder
                    why the walls keep moving.
                  </p>
                  <p>
                    To read well is to choose a boundary — a column, a measure, a moment that does
                    not ask to be shared.
                  </p>
                </div>
              </div>
              <div className="pointer-events-none absolute -bottom-16 -right-10 size-52 rounded-full bg-white/5 blur-2xl" />
            </Card>
          </Reveal>

          <Reveal delay={0.05} className="md:col-span-5">
            <Card className="h-full overflow-hidden p-0">
              <div className="p-7 md:p-9">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-xl bg-gold-soft text-gold">
                      <ScanLine className="size-4" />
                    </span>
                    <p className="eyebrow">Documents & OCR</p>
                  </div>
                  <Badge variant="gold">eng + kan</Badge>
                </div>
                <h3 className="mt-5 font-serif text-[27px] leading-[1.1] text-ink">
                  Scans become readable text.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                  Upload a PDF or image. Embedded text is preserved; scans are OCR&apos;d with
                  Tesseract, never silently guessed.
                </p>
              </div>
              <div className="mx-6 mb-7 rounded-2xl border border-line bg-paper p-5 md:mx-9">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                    Page 02 · Kannada + English
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-medium text-forest">
                    <span className="size-1.5 rounded-full bg-forest-light" /> 96.1% confidence
                  </span>
                </div>
                <p className="mt-4 font-kannada text-[22px] leading-relaxed text-ink">
                  ಓದುವ ಸ್ವಾತಂತ್ರ್ಯ
                </p>
                <p className="mt-1 text-sm text-ink-soft">The freedom to read.</p>
                <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-line/60">
                  <motion.div
                    initial={{ width: "8%" }}
                    whileInView={{ width: "96%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.4, ease: "easeOut" }}
                    className="h-full rounded-full bg-forest-light"
                  />
                </div>
                <p className="mt-2 text-[10px] text-ink-muted">
                  Language model: kan+eng · diagnostics attached to the result
                </p>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.12} className="md:col-span-7">
            <Card className="relative h-full overflow-hidden border-forest/30 bg-[#16241d] p-7 text-white md:p-9">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-[#a9c9b4]">
                    <ShieldCheck className="size-4" />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
                    Security Lab
                  </p>
                </div>
                <span className="rounded-full border border-white/15 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-white/55">
                  Local fixtures only
                </span>
              </div>
              <h3 className="mt-5 max-w-md font-serif text-[30px] leading-[1.08]">
                See the defences, not just the promise.
              </h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/60">
                Five guided scenarios — public content, client-side restrictions, server-side
                protection, metadata exposure and secure document delivery — with inspectable
                evidence for each.
              </p>

              <div className="mt-7 overflow-hidden rounded-xl border border-white/10 bg-black/25 font-mono text-[11px]">
                <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
                  <span className="size-2 rounded-full bg-[#d27a5f]" />
                  <span className="size-2 rounded-full bg-[#c6a45c]" />
                  <span className="size-2 rounded-full bg-[#7d9e88]" />
                  <span className="ml-2 text-[9px] uppercase tracking-[0.16em] text-white/30">
                    request inspector
                  </span>
                </div>
                <div className="space-y-1.5 p-4 text-white/65">
                  <p>
                    <span className="text-[#d9a47f]">POST</span> /api/v1/analyze{" "}
                    <span className="text-white/30">→</span> http://169.254.169.254/latest/meta-data
                  </p>
                  <p className="text-[#e08b6b]">
                    403 BLOCKED_TARGET <span className="text-white/30">·</span> private, loopback or
                    metadata address
                  </p>
                  <p className="text-white/35">
                    dns re-resolved after redirect <span className="text-[#89b39a]">✓</span> ·
                    scheme re-validated <span className="text-[#89b39a]">✓</span>
                  </p>
                </div>
              </div>
              <div className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full border border-white/5" />
            </Card>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-line/80 bg-paper-deep/60 py-24 md:py-32">
        <div className="container-editorial">
          <Reveal>
            <SectionIntro
              eyebrow="Three movements"
              title={
                <>
                  From link to <span className="italic">edition</span> in moments.
                </>
              }
              copy="A deliberately short pipeline, with safety checks at every seam."
            />
          </Reveal>
          <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-3">
            {steps.map((step, index) => (
              <Reveal key={step.number} delay={index * 0.07}>
                <div className="group h-full bg-paper p-7 transition-colors duration-500 hover:bg-paper-soft md:p-9">
                  <div className="flex items-start justify-between">
                    <span className="font-serif text-[42px] leading-none text-accent/25 transition-colors group-hover:text-accent/40">
                      {step.number}
                    </span>
                    <ArrowUpRight className="size-4 text-ink-muted/40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                  <h3 className="mt-8 font-serif text-2xl text-ink">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">{step.copy}</p>
                  <p className="mt-6 border-t border-line/70 pt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                    {step.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container-editorial py-24 md:py-32">
        <div className="relative grid overflow-hidden rounded-[32px] bg-forest text-white lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative z-10 p-8 md:p-12 lg:p-14">
            <Quote className="size-8 text-[#a9c9b4]" />
            <p className="mt-6 max-w-lg font-serif text-[26px] leading-[1.25] md:text-[32px]">
              “A page can be generous or hostile; most are merely loud. To read well is to choose a
              boundary.”
            </p>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Mira Sen · The quiet architecture of attention
            </p>
            <p className="mt-8 max-w-md text-sm leading-relaxed text-white/60">
              A complete sample edition, built from Ghost Reader&apos;s own demo article. Try the
              reader, the newspaper, the typography controls and the access report — no network
              required.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                variant="soft"
                size="lg"
                className="bg-white text-forest hover:bg-white/90"
              >
                <Link href="/demo">
                  Read the sample edition <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="border border-white/15 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/security-lab">Enter the Security Lab</Link>
              </Button>
            </div>
          </div>
          <div className="relative min-h-[300px] lg:min-h-[440px]">
            <Image
              src="/demo-illustration.svg"
              alt="A quiet reading room with an arched window and an armchair"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 45vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-forest via-forest/20 to-transparent lg:bg-gradient-to-r" />
            <div className="absolute bottom-6 right-6 rounded-2xl border border-white/15 bg-black/25 px-4 py-3 backdrop-blur-md">
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/45">Sample edition</p>
              <p className="mt-1 font-serif text-lg">The Ghost Review</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line/80">
        <div className="container-editorial py-24 md:py-28">
          <Reveal>
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <SectionIntro eyebrow="A different bargain" title="Built on restraint." />
              <Link
                href="/about#ethics"
                className="link-underline inline-flex items-center gap-2 text-sm font-medium text-ink"
              >
                Read the full methodology <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {principles.map((principle, index) => (
              <Reveal key={principle.title} delay={index * 0.06}>
                <div className="border-t border-line pt-6">
                  <principle.icon className="size-5 text-accent" />
                  <h3 className="mt-5 font-serif text-xl text-ink">{principle.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{principle.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-line/80 bg-paper-soft/60">
        <GhostMark
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 size-[620px] -translate-x-1/2 -translate-y-1/2 text-accent/[0.035]"
        />
        <div className="container-editorial relative py-24 text-center md:py-32">
          <Reveal>
            <p className="eyebrow">The page, returned</p>
            <h2 className="mx-auto mt-5 max-w-3xl font-serif text-display-sm text-ink">
              Give the page back
              <br />
              to the <span className="italic text-accent">words.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-ink-soft">
              No account. No feed. No performance. Just a link, a clean edition and somewhere quiet
              to keep it.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/analyze">
                  Analyze a page <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/documents">
                  <FileScan className="size-4" /> Try document OCR
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="size-3.5" /> Public web only
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LockKeyhole className="size-3.5" /> SSRF protected
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Fingerprint className="size-3.5" /> Evidence attached
              </span>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
