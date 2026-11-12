import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  Eye,
  FileScan,
  Fingerprint,
  Globe2,
  Layers,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Split,
  X,
} from "lucide-react";
import Link from "next/link";

import { PageHeading } from "@/components/ui/page-heading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  description:
    "How Ghost Reader retrieves, extracts and presents public web content — including its access taxonomy, security model, OCR diagnostics and explicit limits.",
};

const pipeline = [
  {
    step: "01",
    title: "Validate",
    copy: "Only http and https. Ports 80 and 443. DNS is resolved and checked against private, loopback, link-local, multicast and cloud-metadata ranges before connection.",
  },
  {
    step: "02",
    title: "Respect",
    copy: "robots.txt is retrieved and evaluated per path. A disallowed path is reported, not routed around. Redirects are re-validated at every hop.",
  },
  {
    step: "03",
    title: "Retrieve",
    copy: "A bounded HTTP fetch with timeout, byte ceiling, accepted content types and manual redirect handling. No credentials, cookies or browser profiles are replayed.",
  },
  {
    step: "04",
    title: "Assess",
    copy: "Structured data, visible notices, password forms, HTTP status and extractable text are weighed together. Access status is evidence-backed and always attached.",
  },
  {
    step: "05",
    title: "Extract",
    copy: "Metadata is separated from body text. Article structure is rebuilt as typed blocks. JSON-LD articleBody is treated as evidence, never as content.",
  },
  {
    step: "06",
    title: "Present",
    copy: "Images are fetched through short-lived signed proxy URLs. The reader, newspaper and print editions share one canonical extraction.",
  },
];

const accessRows = [
  {
    status: "PUBLIC_FULL",
    meaning: "Publisher signals and retrieved text indicate the complete article is public.",
    behaviour: "Full edition is available.",
  },
  {
    status: "PUBLIC_PARTIAL",
    meaning: "Some article text is public, but a paywall or limit notice is present.",
    behaviour: "Only public text is rendered; the limit is explained.",
  },
  {
    status: "SUBSCRIPTION_REQUIRED",
    meaning: "The publisher indicates subscriber-only access.",
    behaviour: "No subscriber content is reconstructed or bypassed.",
  },
  {
    status: "LOGIN_REQUIRED",
    meaning: "The page asks for an authenticated session.",
    behaviour: "No credentials are requested, stored or replayed.",
  },
  {
    status: "ACCESS_CHALLENGE",
    meaning: "A bot challenge or human-verification gate is present.",
    behaviour: "Ghost Reader stops and reports the challenge.",
  },
  {
    status: "JS_REQUIRED",
    meaning: "Meaningful content requires client-side rendering.",
    behaviour: "Optional isolated browser fallback if the operator enabled it; otherwise reported.",
  },
  {
    status: "BLOCKED_BY_POLICY",
    meaning: "robots.txt or publisher policy disallows this retrieval.",
    behaviour: "The request is refused.",
  },
  {
    status: "FETCH_FAILED",
    meaning: "The page could not be safely retrieved.",
    behaviour: "A plain failure is shown with no fabrication.",
  },
];

export default function AboutPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative border-b border-line/70">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="fine-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="container-editorial relative py-16 md:py-24">
          <PageHeading
            eyebrow="Methodology & ethics"
            title={
              <>
                A reading room with
                <br />
                <span className="italic text-accent">glass walls.</span>
              </>
            }
            description="Ghost Reader is a deliberate alternative to scraping: a personal reading tool that retrieves public content, explains its reasoning and refuses to cross publisher boundaries. This page is the full account."
          />
          <div className="mt-8 flex flex-wrap gap-2">
            <Badge variant="forest">
              <ShieldCheck className="size-3" /> Public content only
            </Badge>
            <Badge variant="outline">
              <Fingerprint className="size-3" /> Evidence attached
            </Badge>
            <Badge variant="outline">
              <LockKeyhole className="size-3" /> No credential handling
            </Badge>
            <Badge variant="outline">
              <BookOpen className="size-3" /> Local-first library
            </Badge>
          </div>
        </div>
      </section>

      <section className="container-editorial py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="h-px w-7 bg-accent" /> The premise
            </p>
            <h2 className="mt-4 font-serif text-[clamp(2rem,4vw,3rem)] leading-[1.04] text-ink">
              Reading is not a licence to take.
            </h2>
          </div>
          <div className="max-w-2xl space-y-5 text-[15px] leading-[1.8] text-ink-soft">
            <p>
              <span className="float-left mr-2 mt-1 font-serif text-[58px] leading-[0.72] text-accent">
                T
              </span>
              he public web is full of writing worth keeping, and full of walls that mean what they
              say. Ghost Reader exists in the space between: it will turn a genuinely public article
              into a quiet, legible edition, and it will stop at a paywall, login form or challenge
              without pretending otherwise.
            </p>
            <p>
              That restraint is a product decision, not a limitation to be engineered away. A tool
              that circumvents access controls is not a reader; it is an unauthorised distribution
              system. Ghost Reader never sends credentials, never solves challenges, never rewrites
              cookies and never renders subscriber-only text as though it were public.
            </p>
            <p>
              What it does instead is make its reasoning visible. Every edition carries an access
              verdict, the evidence behind that verdict, extraction notes and — for documents — OCR
              provenance down to the page. If the tool is unsure, it says so.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-line/70 bg-paper-soft/50 py-20 md:py-24">
        <div className="container-editorial">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">The pipeline</p>
              <h2 className="mt-3 font-serif text-[clamp(2rem,4vw,3rem)] text-ink">
                Six gates before a word is shown.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-ink-muted">
              Safety is not a final check. It is a sequence of refusals that happen before the next
              step is allowed.
            </p>
          </div>

          <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
            {pipeline.map((item) => (
              <li key={item.step} className="bg-paper p-6 transition-colors hover:bg-paper-soft">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-accent">
                    {item.step}
                  </span>
                  <span className="h-px w-8 bg-line" />
                </div>
                <h3 className="mt-4 font-serif text-xl text-ink">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{item.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="ethics" className="container-editorial py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="h-px w-7 bg-accent" /> Ethics & limits
            </p>
            <h2 className="mt-4 font-serif text-[clamp(2rem,4vw,3rem)] leading-[1.04] text-ink">
              The access taxonomy.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">
              Ghost Reader uses a fixed vocabulary for access. The label is not decorative — it
              determines what the rest of the system is allowed to do.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="hidden grid-cols-[0.9fr_1.25fr_1fr] gap-4 border-b border-line bg-paper-deep/60 px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-muted md:grid">
              <span>Status</span>
              <span>Meaning</span>
              <span>Behaviour</span>
            </div>
            {accessRows.map((row, index) => (
              <div
                key={row.status}
                className={`grid gap-1.5 px-5 py-4 md:grid-cols-[0.9fr_1.25fr_1fr] md:gap-4 ${
                  index > 0 ? "border-t border-line/70" : ""
                }`}
              >
                <span className="font-mono text-[10px] font-semibold text-accent">
                  {row.status}
                </span>
                <span className="text-xs leading-relaxed text-ink-soft">{row.meaning}</span>
                <span className="text-xs leading-relaxed text-ink-muted">{row.behaviour}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-forest/20 bg-forest-soft/40 p-6">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-forest">
              <Check className="size-4" /> What we will do
            </p>
            <ul className="mt-4 space-y-2.5">
              {[
                "Retrieve a public page once, on your explicit request.",
                "Explain the access verdict and the evidence behind it.",
                "Preserve article hierarchy, captions and attribution.",
                "Keep your library and reading history in your browser.",
                "Report OCR languages, confidence and failures honestly.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-xs leading-relaxed text-ink-soft">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-forest" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-accent/20 bg-accent-soft/30 p-6">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent-dark">
              <X className="size-4" /> What we will not do
            </p>
            <ul className="mt-4 space-y-2.5">
              {[
                "Bypass a paywall, login wall or access challenge.",
                "Store, replay or request your publisher credentials.",
                "Turn extracted content into a public mirror or feed.",
                "Fabricate body text from metadata or cached fragments.",
                "Use an open image proxy or accept unsigned document IDs.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-xs leading-relaxed text-ink-soft">
                  <X className="mt-0.5 size-3.5 shrink-0 text-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-line/70 bg-paper-deep/50 py-20 md:py-24">
        <div className="container-editorial grid gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <ScanLine className="size-3.5 text-accent" /> Documents & OCR
            </p>
            <h2 className="mt-3 font-serif text-[clamp(2rem,4vw,2.8rem)] leading-[1.05] text-ink">
              A scan is not a sentence yet.
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-ink-soft">
              <p>
                Embedded PDF text is extracted first and left alone where possible. Only pages
                without a usable text layer are rasterised and sent to Tesseract. This keeps
                selectable documents faithful and avoids paying an OCR tax on text that was already
                there.
              </p>
              <p>
                Kannada and English are first-class OCR languages. The service checks for the
                required models before processing, reports the languages it actually used and
                attaches confidence and per-page warnings. A missing language pack produces a
                visible diagnostic — never a silent fallback to English.
              </p>
              <p>
                Files are temporary. They are stored with owner-only permissions and removed by the
                cleanup cycle; document sessions expire after thirty minutes.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-paper p-5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  Sample recognition
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-forest">
                  <span className="size-1.5 rounded-full bg-forest-light" /> 95.9% confidence
                </span>
              </div>
              <p className="mt-5 font-kannada text-2xl leading-relaxed text-ink">
                ಘೋಸ್ಟ್ ರೀಡರ್ ಓದುವ ಸ್ಥಳ
              </p>
              <p className="mt-1 text-sm text-ink-soft">Ghost Reader — a place for reading.</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Badge variant="outline">kan</Badge>
                <Badge variant="outline">eng</Badge>
                <Badge variant="forest">Tesseract 5.5</Badge>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-gold/30 bg-gold-soft/50 p-4">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-gold" />
              <p className="text-[11px] leading-relaxed text-ink-soft">
                OCR is probabilistic. Complex scripts, low-resolution scans and unusual layouts can
                reduce accuracy. Always compare OCR text with the original page when the wording
                matters.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="technology" className="container-editorial py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <Layers className="size-3.5 text-accent" /> Technology
            </p>
            <h2 className="mt-3 font-serif text-[clamp(2rem,4vw,3rem)] leading-[1.04] text-ink">
              Boring where it matters.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">
              The stack is chosen for auditability: typed boundaries, explicit parsers and no
              mystery services receiving your documents.
            </p>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {[
                "Next.js",
                "React",
                "TypeScript",
                "Tailwind CSS",
                "FastAPI",
                "Pydantic",
                "trafilatura",
                "BeautifulSoup",
                "PyMuPDF",
                "Tesseract",
                "Redis (optional)",
                "IndexedDB",
              ].map((item) => (
                <Badge key={item} variant="outline" className="normal-case tracking-normal">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {[
              {
                icon: ShieldCheck,
                title: "Network boundary",
                copy: "Manual redirect handling with DNS re-validation on every hop. Private, reserved, loopback, link-local and metadata ranges are denied. HTTPS-to-HTTP downgrade is refused.",
              },
              {
                icon: Eye,
                title: "Evidence boundary",
                copy: "Access classification and extraction notes are part of the result schema. The interface has no path that renders unclassified JSON-LD as body text.",
              },
              {
                icon: Split,
                title: "Delivery boundary",
                copy: "Remote images are delivered through HMAC-signed, expiring URLs. Document files are addressed by temporary job IDs, not local paths.",
              },
              {
                icon: FileScan,
                title: "Processing boundary",
                copy: "Uploads are size- and page-limited. PDFs are inspected before rendering. OCR failures are explicit and never replaced by invented text.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex gap-4 rounded-xl border border-line bg-paper-soft p-4"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <item.icon className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{item.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line/70 bg-paper-soft/60">
        <div className="container-editorial py-16">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <Globe2 className="size-5 text-accent" />
              <h2 className="mt-3 font-serif text-xl text-ink">Known limits</h2>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                JavaScript-heavy publications may yield little content unless an isolated browser
                fallback is enabled. Bot-protected pages are reported, not fought. Newspaper and
                reader editions are only as good as the publisher&apos;s public markup.
              </p>
            </div>
            <div>
              <LockKeyhole className="size-5 text-accent" />
              <h2 className="mt-3 font-serif text-xl text-ink">No bypass, ever</h2>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                The presence of a paywall, login or challenge is an instruction to stop. Ghost
                Reader does not claim to retrieve what the publisher has chosen not to serve
                publicly.
              </p>
            </div>
            <div>
              <Sparkles className="size-5 text-accent" />
              <h2 className="mt-3 font-serif text-xl text-ink">A local archive</h2>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                Saved editions live in IndexedDB on your device. There is no account or cloud
                library. Clearing site data removes them; export a JSON backup if you want to keep
                them.
              </p>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center gap-4 border-t border-line pt-10 text-center">
            <p className="font-serif text-2xl text-ink">The boundary is the feature.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/analyze">
                  Analyze a public page <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/security-lab">Enter the Security Lab</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
