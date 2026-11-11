import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { SystemStatus } from "@/components/layout/system-status";

const columns = [
  {
    title: "Read",
    links: [
      { href: "/analyze", label: "Analyze a page" },
      { href: "/documents", label: "Documents & OCR" },
      { href: "/library", label: "Your library" },
      { href: "/demo", label: "Sample edition" },
    ],
  },
  {
    title: "Understand",
    links: [
      { href: "/about", label: "Methodology" },
      { href: "/about#ethics", label: "Ethics & limits" },
      { href: "/security-lab", label: "Security Lab" },
      { href: "/about#technology", label: "Technology" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="noise relative mt-24 border-t border-line/80 bg-paper-deep/50">
      <div className="container-editorial py-16">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr_1fr]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-5 text-sm leading-relaxed text-ink-soft">
              A reading room for the public web. Ghost Reader turns accessible pages and your own
              documents into calm, legible editions — and shows its work.
            </p>
            <div className="mt-6">
              <SystemStatus />
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="eyebrow">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="link-underline inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-ink"
                    >
                      {link.label}
                      <ArrowUpRight className="size-3 opacity-40" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-line/70 pt-6 text-xs text-ink-muted md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Ghost Reader. Built for readable, public knowledge.</p>
          <p className="max-w-xl leading-relaxed md:text-right">
            Ghost Reader respects robots.txt, paywalls and authentication. It never bypasses access
            controls. Only analyze pages you have the right to read.
          </p>
        </div>
      </div>
    </footer>
  );
}
