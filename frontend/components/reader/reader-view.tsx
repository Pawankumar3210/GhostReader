"use client";

import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  Columns2,
  Copy,
  ExternalLink,
  Info,
  Minus,
  Newspaper,
  Plus,
  Printer,
  ShieldCheck,
  Type,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { AccessBadge, accessTone } from "@/components/reader/access-badge";
import { HomeButton } from "@/components/reader/home-button";
import { ReaderThemePicker } from "@/components/reader/reader-theme-picker";
import { NewspaperPages } from "@/components/reader/newspaper-pages";
import { NewspaperPdfButton } from "@/components/reader/newspaper-pdf-button";
import { useLibrary } from "@/components/providers/library-provider";
import { useReaderPreferences } from "@/hooks/use-reader-preferences";
import { mediaUrl } from "@/lib/api";
import { cn, formatDate, hostname } from "@/lib/utils";
import type { AnalysisResult, ContentBlock } from "@/types/api";

function headingId(index: number) {
  return `section-${index}`;
}

function ReaderBlock({
  block,
  index,
  firstParagraph,
}: {
  block: ContentBlock;
  index: number;
  firstParagraph: boolean;
}) {
  switch (block.type) {
    case "heading": {
      const Heading = block.level && block.level >= 3 ? "h3" : "h2";
      return <Heading id={headingId(index)}>{block.text}</Heading>;
    }
    case "subheading":
      return (
        <h3 id={headingId(index)} className="mt-10">
          {block.text}
        </h3>
      );
    case "quote":
      return (
        <blockquote>
          <p>{block.text}</p>
          {block.attribution && (
            <footer className="mt-3 font-sans text-[0.62em] uppercase not-italic tracking-[0.16em] opacity-70">
              — {block.attribution}
            </footer>
          )}
        </blockquote>
      );
    case "list":
      return (
        <ul>
          {(block.items ?? []).map((item, itemIndex) => (
            <li key={itemIndex}>{item}</li>
          ))}
        </ul>
      );
    case "image": {
      const source = mediaUrl(block.proxy_url ?? block.image_url);
      if (!source) return null;
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={source}
            alt={block.alt ?? block.caption ?? "Article illustration"}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          {(block.caption || block.attribution) && (
            <figcaption>
              {block.caption}
              {block.attribution && <span className="ml-1 opacity-70">— {block.attribution}</span>}
            </figcaption>
          )}
        </figure>
      );
    }
    case "caption":
      return (
        <p className="font-sans text-[0.68em] leading-relaxed text-[color:var(--reader-muted)]">
          {block.text}
        </p>
      );
    case "embed":
      return (
        <div className="reader-card rounded-xl p-4 font-sans text-xs text-[color:var(--reader-muted)]">
          Embedded content was omitted to protect your privacy.
          {block.text && <span className="ml-1">{block.text}</span>}
        </div>
      );
    default:
      return <p className={firstParagraph ? "reader-dropcap" : undefined}>{block.text}</p>;
  }
}

export function ReaderView({
  result,
  sourceJobId,
  backHref = "/analyze",
  backLabel = "Back",
  demo = false,
}: {
  result: AnalysisResult;
  sourceJobId?: string;
  backHref?: string;
  backLabel?: string;
  demo?: boolean;
}) {
  const { preferences, hydrated, update } = useReaderPreferences();
  const { saved, save, remove, unavailable } = useLibrary();
  const [progress, setProgress] = useState(0);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement>(null);

  const savedArticle = saved.find((article) => article.result.source_url === result.source_url);
  const newspaperPages = result.newspaper_pages ?? [];
  const firstParagraphIndex = useMemo(
    () => result.content.findIndex((block) => block.type === "paragraph"),
    [result.content],
  );
  const headings = useMemo(
    () =>
      result.content
        .map((block, index) => ({ block, index }))
        .filter(
          ({ block }) =>
            (block.type === "heading" || block.type === "subheading") && Boolean(block.text),
        ),
    [result.content],
  );

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const container = articleRef.current;
    if (!container || headings.length === 0) return;
    const elements = headings
      .map(({ index }) => container.querySelector<HTMLElement>(`#${headingId(index)}`))
      .filter((element): element is HTMLElement => Boolean(element));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveHeading(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: [0, 1] },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [headings]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2800);
    return () => clearTimeout(timer);
  }, [notice]);

  async function toggleSaved() {
    if (unavailable) {
      setNotice("Local storage is unavailable in this browser.");
      return;
    }
    if (savedArticle) {
      await remove(savedArticle.id);
      setNotice("Removed from your library.");
    } else {
      await save(result);
      setNotice("Saved to your local library.");
    }
  }

  async function copySource() {
    try {
      await navigator.clipboard.writeText(result.source_url);
      setNotice("Source link copied.");
    } catch {
      setNotice("The link could not be copied.");
    }
  }

  const style = {
    "--reader-font-size": `${(21 * preferences.fontScale).toFixed(1)}px`,
    "--reader-measure": `${preferences.measure}ch`,
  } as CSSProperties;

  const restricted = result.access_status !== "PUBLIC_FULL";
  const editionDate = formatDate(result.published_at);
  const editionDetails: [string, string][] = [
    ["Source", hostname(result.source_url)],
    ["Extractor", result.extractor ?? "—"],
    ["Fetched via", result.fetched_via],
    ["Language", result.language ?? "—"],
    ...(newspaperPages.length > 0
      ? ([["Pages", String(newspaperPages.length)]] as [string, string][])
      : ([["Images", String(result.images.length)]] as [string, string][])),
    ["Published", editionDate],
  ];

  return (
    <div
      className="reader-root min-h-screen"
      data-reader-theme={preferences.theme}
      data-reader-typeface={preferences.typeface}
    >
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-[90] h-[2px] origin-left bg-[color:var(--reader-accent)] transition-transform duration-150"
        style={{ transform: `scaleX(${progress / 100})` }}
      />

      <header className="reader-chrome reader-divider sticky top-0 z-50 border-b">
        <div className="relative mx-auto flex max-w-[1280px] flex-col sm:h-16 sm:flex-row sm:items-center sm:gap-3 sm:px-4 md:px-7">
          <div className="flex justify-center py-2 sm:absolute sm:left-1/2 sm:top-1/2 sm:z-10 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:py-0">
            <HomeButton />
          </div>
          <div className="flex w-full min-w-0 items-center justify-between gap-3 px-4 pb-2 sm:px-0 sm:pb-0">
            <div className="flex min-w-0 items-center gap-2">
              {backHref !== "/" && (
                <>
                  <Link
                    href={backHref}
                    className="reader-toolbar-button shrink-0"
                    aria-label={backLabel}
                  >
                    <ArrowLeft className="size-4" />
                    <span className="hidden sm:inline">{backLabel}</span>
                  </Link>
                  <span className="mx-1 hidden h-4 w-px bg-[color:var(--reader-rule)] sm:block" />
                </>
              )}
              <div className="min-w-0">
                {result.publisher && result.publisher !== result.title && (
                  <p className="reader-muted hidden truncate text-[11px] font-medium uppercase tracking-[0.14em] md:block">
                    {result.publisher}
                  </p>
                )}
                <p className="truncate font-serif text-[15px] leading-tight text-[color:var(--reader-fg)]">
                  {result.title ?? "Untitled edition"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={toggleSaved}
                className="reader-toolbar-button"
                data-active={Boolean(savedArticle)}
                aria-pressed={Boolean(savedArticle)}
                title={savedArticle ? "Remove from library" : "Save to library"}
              >
                {savedArticle ? (
                  <BookmarkCheck className="size-4" />
                ) : (
                  <Bookmark className="size-4" />
                )}
                <span className="hidden lg:inline">{savedArticle ? "Saved" : "Save"}</span>
              </button>
              <button
                type="button"
                onClick={copySource}
                className="reader-toolbar-button"
                title="Copy source link"
              >
                <Copy className="size-4" />
                <span className="hidden lg:inline">Source</span>
              </button>
              {sourceJobId && (
                <Link
                  href={`/newspaper/${sourceJobId}`}
                  className="reader-toolbar-button"
                  title="Newspaper view"
                >
                  <Newspaper className="size-4" />
                  <span className="hidden lg:inline">Newspaper</span>
                </Link>
              )}
              <NewspaperPdfButton
                pages={newspaperPages}
                title={result.title ?? "Newspaper edition"}
                publishedAt={result.published_at}
              />
              <button
                type="button"
                onClick={() => window.print()}
                className="reader-toolbar-button"
                title="Print this edition"
              >
                <Printer className="size-4" />
                <span className="hidden lg:inline">Print</span>
              </button>
            </div>
          </div>
        </div>

        <div className="reader-divider border-t">
          <div className="mx-auto flex max-w-[1280px] items-center gap-1 overflow-x-auto px-4 py-2 md:px-7">
            <ReaderThemePicker value={preferences.theme} onChange={(theme) => update({ theme })} />

            {newspaperPages.length === 0 && (
              <>
                <span className="mx-1.5 h-4 w-px shrink-0 bg-[color:var(--reader-rule)]" />

                <button
                  type="button"
                  onClick={() =>
                    update({ typeface: preferences.typeface === "serif" ? "sans" : "serif" })
                  }
                  className="reader-toolbar-button shrink-0"
                  title="Toggle typeface"
                >
                  <Type className="size-3.5" />
                  <span className="capitalize">{preferences.typeface}</span>
                </button>

                <span className="mx-1.5 h-4 w-px shrink-0 bg-[color:var(--reader-rule)]" />

                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      update({ fontScale: Math.max(0.85, preferences.fontScale - 0.05) })
                    }
                    className="reader-toolbar-button px-2"
                    aria-label="Decrease text size"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="reader-muted grid h-8 w-9 place-items-center font-serif text-[13px]">
                    Aa
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      update({ fontScale: Math.min(1.35, preferences.fontScale + 0.05) })
                    }
                    className="reader-toolbar-button px-2"
                    aria-label="Increase text size"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>

                <span className="mx-1.5 hidden h-4 w-px shrink-0 bg-[color:var(--reader-rule)] sm:block" />

                <div className="hidden shrink-0 items-center gap-1 sm:flex">
                  {[56, 64, 72].map((measure) => (
                    <button
                      key={measure}
                      type="button"
                      onClick={() => update({ measure })}
                      className={cn(
                        "reader-chip h-7 rounded-full px-2 font-mono text-[10px]",
                        measure === 72 && "px-1.5",
                      )}
                      data-active={preferences.measure === measure}
                      title={`${measure} character measure`}
                    >
                      {measure === 56 ? "Narrow" : measure === 64 ? "Regular" : "Wide"}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="reader-muted ml-auto hidden shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] md:flex">
              <span className="size-1.5 rounded-full bg-[color:var(--reader-accent)]" />
              {hydrated ? "Reader" : "…"}
            </div>
          </div>
        </div>
      </header>

      {demo && (
        <div className="reader-divider border-b bg-[color:var(--reader-accent)] px-4 py-2 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-white">
          Sample edition · bundled locally · no network request
        </div>
      )}

      <div className="mx-auto grid max-w-[1220px] gap-14 px-5 py-10 md:px-8 md:py-16 xl:grid-cols-[minmax(0,1fr)_270px] xl:gap-16">
        <article ref={articleRef} className="min-w-0">
          <div className="mx-auto max-w-[var(--reader-measure)]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="reader-muted inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
                <span className="size-1.5 rounded-full bg-[color:var(--reader-accent)]" />
                {result.publisher ?? hostname(result.source_url)}
              </span>
              <AccessBadge status={result.access_status} />
              <span className="reader-muted text-[10px] font-medium uppercase tracking-[0.14em]">
                {result.content_type.replaceAll("_", " ").toLowerCase()}
              </span>
            </div>

            <h1 className="mt-5 font-serif text-[clamp(2.35rem,5vw,4rem)] font-normal leading-[1.02] tracking-[-0.035em] text-[color:var(--reader-fg)]">
              {result.title ?? "Untitled edition"}
            </h1>
            {result.subtitle && (
              <p className="reader-soft mt-4 font-serif text-[clamp(1.1rem,2vw,1.45rem)] italic leading-snug">
                {result.subtitle}
              </p>
            )}

            <div className="reader-divider reader-muted mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-y py-3 font-sans text-[11px]">
              {result.author && (
                <span className="font-medium text-[color:var(--reader-soft)]">
                  By {result.author}
                </span>
              )}
              <span>{editionDate}</span>
              <span>
                {newspaperPages.length > 0
                  ? `${newspaperPages.length} ${newspaperPages.length === 1 ? "page" : "pages"}`
                  : `${result.reading_time_minutes} min · ${result.word_count.toLocaleString()} words`}
              </span>
              <a
                href={result.source_url}
                target="_blank"
                rel="noreferrer noopener"
                className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-[color:var(--reader-accent)]"
              >
                Original <ExternalLink className="size-3" />
              </a>
            </div>

            {restricted && (
              <div
                className={cn(
                  "mt-8 rounded-2xl border p-5 font-sans text-sm",
                  accessTone(result.access_status),
                )}
              >
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-semibold">{result.access_assessment.explanation}</p>
                    {result.access_assessment.evidence.length > 0 && (
                      <details className="group mt-2">
                        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium opacity-80">
                          Why this verdict
                          <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                        </summary>
                        <ul className="mt-2 space-y-1.5 text-xs opacity-85">
                          {result.access_assessment.evidence.map((item, index) => (
                            <li key={index} className="flex gap-2">
                              <span className="opacity-50">·</span> {item}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}

            {result.description && result.description !== result.subtitle && (
              <p className="reader-soft mt-8 border-l-2 border-[color:var(--reader-accent)] pl-5 font-serif text-[1.12em] italic leading-relaxed">
                {result.description}
              </p>
            )}

            {newspaperPages.length > 0 ? (
              <NewspaperPages
                pages={newspaperPages}
                editionTitle={result.title ?? "Newspaper edition"}
              />
            ) : (
              <div
                className="reader-column mt-10"
                data-typeface={preferences.typeface}
                style={style}
              >
                {result.content.map((block, index) => (
                  <ReaderBlock
                    key={`${block.type}-${index}`}
                    block={block}
                    index={index}
                    firstParagraph={index === firstParagraphIndex}
                  />
                ))}
              </div>
            )}

            <div className="mt-16 flex items-center gap-4">
              <span className="h-px flex-1 bg-[color:var(--reader-rule)]" />
              <span className="reader-muted font-serif text-sm italic">End of edition</span>
              <span className="h-px flex-1 bg-[color:var(--reader-rule)]" />
            </div>

            {result.notes.length > 0 && (
              <details className="group mt-8 font-sans text-xs">
                <summary className="reader-muted flex cursor-pointer list-none items-center gap-2">
                  <ShieldCheck className="size-3.5" />
                  Extraction & safety notes ({result.notes.length})
                  <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="reader-divider reader-soft mt-3 space-y-2 rounded-xl border p-4 leading-relaxed">
                  {result.notes.map((note, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="reader-muted">{String(index + 1).padStart(2, "0")}</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </article>

        <aside className="hidden xl:block">
          <div className="sticky top-36 space-y-6">
            {headings.length > 0 && (
              <div>
                <p className="eyebrow flex items-center gap-2">
                  <Columns2 className="size-3" /> In this edition
                </p>
                <nav className="reader-divider mt-3 space-y-0.5 border-l pl-3">
                  {headings.map(({ block, index }) => (
                    <a
                      key={index}
                      href={`#${headingId(index)}`}
                      className={cn(
                        "block py-1.5 text-[12px] leading-snug transition-colors",
                        activeHeading === headingId(index)
                          ? "font-medium text-[color:var(--reader-accent)]"
                          : "reader-muted hover:text-[color:var(--reader-fg)]",
                        block.type === "subheading" && "pl-3",
                      )}
                    >
                      {block.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}

            <div className="reader-card rounded-2xl p-4">
              <p className="reader-muted flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
                <ShieldCheck className="size-3.5 text-[color:var(--reader-accent)]" /> Access report
              </p>
              <div className="mt-3">
                <AccessBadge status={result.access_status} />
              </div>
              <p className="reader-soft mt-3 text-[11px] leading-relaxed">
                {result.access_assessment.explanation}
              </p>
              <p className="reader-muted mt-2 text-[10px] uppercase tracking-[0.12em]">
                Confidence: {result.access_assessment.confidence}
              </p>
            </div>

            <div className="reader-card rounded-2xl p-4">
              <p className="reader-muted text-[10px] font-semibold uppercase tracking-[0.16em]">
                Edition details
              </p>
              <dl className="mt-3 space-y-2 text-[11px]">
                {editionDetails.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3">
                    <dt className="reader-muted">{label}</dt>
                    <dd className="max-w-[70%] break-words text-right text-[color:var(--reader-soft)]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </aside>
      </div>

      {notice && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[95] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper shadow-lift"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
