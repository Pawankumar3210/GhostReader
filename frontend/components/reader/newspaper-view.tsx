"use client";

import { ArrowLeft, BookOpen, ExternalLink, Printer, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { NewspaperPages } from "@/components/reader/newspaper-pages";
import { mediaUrl } from "@/lib/api";
import { formatDate, hostname } from "@/lib/utils";
import type { AnalysisResult, ContentBlock } from "@/types/api";

function NewspaperBlock({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h2 className="mb-2 mt-5 font-serif text-[22px] font-semibold leading-tight">
          {block.text}
        </h2>
      );
    case "subheading":
      return <h3 className="mb-2 mt-4 font-serif text-[18px] italic">{block.text}</h3>;
    case "quote":
      return (
        <blockquote className="my-4 border-y border-[#1e1a14]/25 py-3 font-serif text-[17px] italic leading-snug">
          {block.text}
          {block.attribution && (
            <footer className="mt-1.5 text-[10px] uppercase not-italic tracking-[0.14em]">
              — {block.attribution}
            </footer>
          )}
        </blockquote>
      );
    case "list":
      return (
        <ul className="mb-3 list-disc space-y-1 pl-5">
          {(block.items ?? []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );
    case "image": {
      const source = mediaUrl(block.proxy_url ?? block.image_url);
      if (!source) return null;
      return (
        <figure className="my-4 break-inside-avoid">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={source}
            alt={block.alt ?? block.caption ?? "Article illustration"}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full border border-[#1e1a14]/20 grayscale-[15%]"
          />
          {(block.caption || block.attribution) && (
            <figcaption className="mt-1 border-b border-[#1e1a14]/15 pb-2 text-[9px] leading-snug text-[#4b4033]">
              {block.caption}
              {block.attribution && ` — ${block.attribution}`}
            </figcaption>
          )}
        </figure>
      );
    }
    case "caption":
      return <p className="text-[10px] italic text-[#56493a]">{block.text}</p>;
    case "embed":
      return null;
    default:
      return <p>{block.text}</p>;
  }
}

export function NewspaperView({
  result,
  sourceJobId,
  demo = false,
}: {
  result: AnalysisResult;
  sourceJobId: string;
  demo?: boolean;
}) {
  const newspaperPages = result.newspaper_pages ?? [];
  const heroImage = useMemo(
    () =>
      newspaperPages.length > 0 ? undefined : result.images.find((image) => Boolean(image.url)),
    [newspaperPages.length, result.images],
  );
  const bodyBlocks = useMemo(
    () =>
      newspaperPages.length > 0
        ? []
        : result.content.filter(
            (block) => block.type !== "image" || block.image_url !== heroImage?.url,
          ),
    [newspaperPages.length, result.content, heroImage],
  );
  const masthead = result.publisher ?? "The Ghost Reader";

  return (
    <div className="paper-texture min-h-screen bg-paper-deep/60 pb-16 text-ink">
      <div className="no-print sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-4">
          <Link
            href={`/reader/${sourceJobId}`}
            className="inline-flex items-center gap-2 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" /> Reader view
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-ink-muted sm:flex">
              <ShieldCheck className="size-3.5 text-forest-light" /> Printer-ready edition
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-ink px-4 text-xs font-medium text-paper transition hover:bg-ink/90"
            >
              <Printer className="size-3.5" /> Print
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1100px] px-3 py-8 md:px-8 md:py-12">
        <article className="newspaper-page paper-texture mx-auto max-w-[980px] px-5 py-8 shadow-[0_40px_90px_-50px_rgba(27,24,20,0.55)] md:px-12 md:py-12">
          <header>
            <div className="flex items-center justify-between border-b border-[#1e1a14]/30 pb-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#4f4234]">
              <span>Ghost Reader Edition</span>
              <span className="hidden sm:block">Read beyond the noise</span>
              <span>{formatDate(result.published_at)}</span>
            </div>

            <h1 className="newspaper-masthead mt-5 text-center text-[clamp(2.8rem,7vw,5.4rem)] font-semibold leading-[0.9]">
              {masthead}
            </h1>

            <div className="mt-4 flex items-center justify-between border-y border-[#1e1a14]/40 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#4f4234]">
              <span>Vol. I · No. 001</span>
              <span className="hidden md:block">
                {result.author ? `By ${result.author}` : "Selected edition"}
              </span>
              <span>
                {newspaperPages.length > 0
                  ? `${newspaperPages.length} pages`
                  : `${result.reading_time_minutes} minute read`}
              </span>
            </div>

            <div className="mt-8 text-center">
              <p className="font-sans text-[9px] font-bold uppercase tracking-[0.26em] text-[#a9412a]">
                {result.content_type.replaceAll("_", " ")}
              </p>
              <h2 className="mx-auto mt-2 max-w-4xl font-serif text-[clamp(2rem,5vw,3.6rem)] font-semibold leading-[0.98] tracking-[-0.035em]">
                {result.title ?? "Untitled edition"}
              </h2>
              {result.subtitle && (
                <p className="mx-auto mt-3 max-w-2xl font-serif text-[16px] italic leading-snug text-[#4b3f31]">
                  {result.subtitle}
                </p>
              )}
              <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#5b4d3d]">
                {result.author ? `By ${result.author}` : hostname(result.source_url)} ·{" "}
                {formatDate(result.published_at)} ·{" "}
                {newspaperPages.length > 0
                  ? `${newspaperPages.length} pages`
                  : `${result.word_count.toLocaleString()} words`}
              </p>
            </div>

            {result.access_status !== "PUBLIC_FULL" && (
              <div className="mt-6 border border-[#a9412a]/40 bg-[#a9412a]/5 px-4 py-3 text-center text-[10px] leading-relaxed text-[#7b3020]">
                <strong className="uppercase tracking-[0.12em]">Publisher limit:</strong>{" "}
                {result.access_assessment.explanation}
              </div>
            )}

            {heroImage && (
              <figure className="mt-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(heroImage.proxy_url ?? heroImage.url)}
                  alt={heroImage.alt ?? heroImage.caption ?? "Edition illustration"}
                  className="max-h-[440px] w-full border border-[#1e1a14]/25 object-cover grayscale-[12%]"
                  referrerPolicy="no-referrer"
                />
                {(heroImage.caption || heroImage.attribution) && (
                  <figcaption className="mt-1.5 border-b border-[#1e1a14]/15 pb-2 text-[9px] leading-snug text-[#4b4033]">
                    {heroImage.caption}
                    {heroImage.attribution && ` — ${heroImage.attribution}`}
                  </figcaption>
                )}
              </figure>
            )}
          </header>

          {newspaperPages.length > 0 ? (
            <NewspaperPages
              pages={newspaperPages}
              editionTitle={result.title ?? masthead}
              variant="print"
            />
          ) : bodyBlocks.length > 0 ? (
            <div className="newspaper-columns mt-8 font-serif text-[12px] leading-[1.65] [&>p:first-child]:first-letter:float-left [&>p:first-child]:first-letter:mr-1 [&>p:first-child]:first-letter:font-serif [&>p:first-child]:first-letter:text-[46px] [&>p:first-child]:first-letter:font-semibold [&>p:first-child]:first-letter:leading-[0.75] [&>p:first-child]:first-letter:text-[#a9412a]">
              {bodyBlocks.map((block, index) => (
                <NewspaperBlock key={`${block.type}-${index}`} block={block} />
              ))}
            </div>
          ) : (
            <div className="mt-10 border-y border-[#1e1a14]/25 py-10 text-center">
              <BookOpen className="mx-auto size-6 text-[#a9412a]" />
              <p className="mt-3 font-serif text-xl">No printable body text was available.</p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#56493a]">
                {result.access_assessment.explanation}
              </p>
            </div>
          )}

          <footer className="mt-10 flex flex-col gap-3 border-t-2 border-[#1e1a14] pt-3 text-[8px] uppercase tracking-[0.14em] text-[#5b4d3d] sm:flex-row sm:items-center sm:justify-between">
            <span>
              {demo ? "Sample edition · bundled locally" : `Source: ${hostname(result.source_url)}`}
            </span>
            <a
              href={result.source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 hover:text-[#a9412a]"
            >
              Original page <ExternalLink className="size-2.5" />
            </a>
          </footer>
        </article>

        <p className="no-print mx-auto mt-5 max-w-[980px] text-center text-[10px] uppercase tracking-[0.16em] text-ink-muted">
          Ghost Reader · an edition, not a webpage
        </p>
      </div>
    </div>
  );
}
