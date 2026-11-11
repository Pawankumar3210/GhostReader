import type { Metadata } from "next";
import { Check, FileText, ScanLine, ShieldCheck, Sparkles } from "lucide-react";

import { DocumentWorkspace } from "@/components/documents/document-workspace";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = {
  title: "Documents & OCR",
  description:
    "Extract embedded text from PDFs and run on-server OCR for scans and images in English and Kannada, with explicit diagnostics.",
};

const steps = [
  {
    number: "01",
    title: "Upload privately",
    copy: "Your document goes to your Ghost Reader backend over a bounded upload channel. Files are stored temporarily with owner-only permissions.",
  },
  {
    number: "02",
    title: "Text first, OCR second",
    copy: "Ghost Reader reads embedded PDF text layers first. Only pages without selectable text are rendered and sent to Tesseract.",
  },
  {
    number: "03",
    title: "Read and verify",
    copy: "Every page reports whether OCR was used, its language and confidence. Warnings are never hidden behind a silent fallback.",
  },
];

export default function DocumentsPage() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[380px]"
      />
      <div className="container-editorial relative py-12 md:py-16">
        <PageHeading
          eyebrow="Documents · OCR"
          title={
            <>
              Read the paper, <span className="italic text-accent">not the pixels.</span>
            </>
          }
          description="Upload a PDF or a photographed page. Ghost Reader preserves what is selectable, reads what is not, and tells you exactly which path each page took."
        />

        <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-[28px] border border-line bg-paper-soft p-6 shadow-card md:p-9">
            <DocumentWorkspace />
          </section>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-line bg-paper p-5">
              <p className="eyebrow flex items-center gap-2">
                <Sparkles className="size-3.5 text-accent" /> Capability, stated plainly
              </p>
              <ul className="mt-4 space-y-3.5">
                {[
                  {
                    icon: ScanLine,
                    title: "Tesseract OCR",
                    copy: "Runs on the Ghost Reader server. No third-party OCR API receives your document.",
                  },
                  {
                    icon: FileText,
                    title: "Embedded text preserved",
                    copy: "Selectable PDF text keeps its original order and never pays an OCR tax.",
                  },
                  {
                    icon: Check,
                    title: "Kannada + English",
                    copy: "Language packs are checked before processing. Missing models produce an explicit diagnostic.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Short-lived by design",
                    copy: "Files and extracted text are deleted automatically after thirty minutes.",
                  },
                ].map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <item.icon className="mt-0.5 size-4 shrink-0 text-forest-light" />
                    <div>
                      <p className="text-xs font-semibold text-ink">{item.title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                        {item.copy}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-line bg-paper p-5">
              <p className="eyebrow">Limits</p>
              <dl className="mt-3 space-y-2 text-[11px]">
                {[
                  ["Maximum file", "40 MB"],
                  ["PDF pages", "80"],
                  ["Image pixels", "45 megapixels"],
                  ["OCR languages", "English + Kannada"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{label}</dt>
                    <dd className="font-medium text-ink-soft">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>

        <div className="mt-16">
          <p className="eyebrow">The path through the document</p>
          <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="bg-paper p-6">
                <span className="font-serif text-3xl text-accent/30">{step.number}</span>
                <h2 className="mt-3 font-serif text-xl text-ink">{step.title}</h2>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
