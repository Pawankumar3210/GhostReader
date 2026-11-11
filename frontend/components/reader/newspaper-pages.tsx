"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, ExternalLink, Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { mediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { NewspaperPage } from "@/types/api";

function pageSource(page: NewspaperPage): string | undefined {
  return mediaUrl(page.proxy_url ?? page.image_url);
}

function PageThumbnail({
  page,
  source,
  index,
  editionTitle,
  pageCount,
  onOpen,
}: {
  page: NewspaperPage;
  source: string;
  index: number;
  editionTitle: string;
  pageCount: number;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open page ${page.page_number} of ${pageCount}`}
      aria-busy={!loaded}
      className="group relative block w-full overflow-hidden rounded-lg border border-[color:var(--reader-rule)] bg-white text-left shadow-[0_18px_40px_-30px_rgba(30,26,20,0.55)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--reader-accent)]"
    >
      <div className="relative aspect-[3437/5396] w-full overflow-hidden bg-[#f4efe6]">
        {!loaded && (
          <span
            aria-hidden
            className="absolute inset-0 animate-pulse bg-gradient-to-b from-[#eee5d8] to-[#e3d7c5]"
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={source}
          alt={page.alt ?? `${editionTitle} — page ${page.page_number}`}
          loading={index < 4 ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          className={cn(
            "h-full w-full object-cover object-top transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-8 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
          Page {page.page_number}
          <Maximize2 className="size-3.5 opacity-80 transition-opacity group-hover:opacity-100" />
        </span>
      </div>
    </button>
  );
}

export function NewspaperPages({
  pages,
  editionTitle,
  variant = "reader",
}: {
  pages: NewspaperPage[];
  editionTitle: string;
  variant?: "reader" | "print";
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activePage = activeIndex === null ? null : pages[activeIndex];

  const close = useCallback(() => setActiveIndex(null), []);
  const move = useCallback(
    (delta: number) => {
      setActiveIndex((current) => {
        if (current === null) return current;
        return Math.min(pages.length - 1, Math.max(0, current + delta));
      });
    },
    [pages.length],
  );

  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, move]);

  if (pages.length === 0) return null;

  if (variant === "print") {
    return (
      <div className="mt-8 space-y-8">
        {pages.map((page) => {
          const source = pageSource(page);
          if (!source) return null;
          return (
            <figure
              key={page.page_number}
              className="newspaper-page break-after-page border border-[#1e1a14]/20 bg-white p-2 shadow-[0_30px_70px_-45px_rgba(27,24,20,0.5)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={source}
                alt={page.alt ?? `${editionTitle} — page ${page.page_number}`}
                loading={page.page_number <= 2 ? "eager" : "lazy"}
                referrerPolicy="no-referrer"
                className="h-auto w-full"
              />
              <figcaption className="mt-2 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-[#5b4d3d]">
                {editionTitle} · page {page.page_number} of {pages.length}
              </figcaption>
            </figure>
          );
        })}
      </div>
    );
  }

  return (
    <section className="mt-10" aria-labelledby="edition-pages-heading">
      <div className="reader-divider flex flex-wrap items-end justify-between gap-3 border-y py-4">
        <div>
          <p className="reader-muted text-[10px] font-semibold uppercase tracking-[0.18em]">
            Public edition
          </p>
          <h2
            id="edition-pages-heading"
            className="mt-1 font-serif text-[clamp(1.5rem,3vw,2rem)] leading-tight text-[color:var(--reader-fg)]"
          >
            All {pages.length} pages
          </h2>
        </div>
        <p className="reader-muted max-w-sm text-right text-[11px] leading-relaxed">
          Select a page to read it full screen. Pages are delivered from the publisher&apos;s public
          viewer.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {pages.map((page, index) => {
          const source = pageSource(page);
          if (!source) return null;
          return (
            <PageThumbnail
              key={page.page_number}
              page={page}
              source={source}
              index={index}
              editionTitle={editionTitle}
              pageCount={pages.length}
              onOpen={() => setActiveIndex(index)}
            />
          );
        })}
      </div>

      <Dialog.Root open={activePage !== null} onOpenChange={(open) => !open && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[99] bg-[#0f0e0c]/95 backdrop-blur-sm" />
          {activePage && activeIndex !== null && (
            <Dialog.Content className="fixed inset-0 z-[100] flex flex-col p-3 text-white focus:outline-none sm:p-5">
              <div className="flex items-center justify-between gap-3 pb-3">
                <div className="min-w-0">
                  <Dialog.Title className="truncate font-serif text-sm sm:text-base">
                    {editionTitle}
                  </Dialog.Title>
                  <Dialog.Description className="text-[10px] uppercase tracking-[0.16em] text-white/65">
                    Page {activePage.page_number} of {pages.length}
                  </Dialog.Description>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={activePage.image_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex size-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
                    title="Open the original page image"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="inline-flex size-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
                      title="Close page viewer"
                      aria-label="Close page viewer"
                    >
                      <X className="size-5" />
                    </button>
                  </Dialog.Close>
                </div>
              </div>

              <div className="relative flex min-h-0 flex-1 items-center justify-center">
                <button
                  type="button"
                  onClick={() => move(-1)}
                  disabled={activeIndex === 0}
                  className="absolute left-0 z-10 inline-flex size-10 items-center justify-center rounded-full bg-black/45 text-white/85 transition hover:bg-black/70 disabled:opacity-25 sm:left-2"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-6" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pageSource(activePage) ?? ""}
                  alt={activePage.alt ?? `${editionTitle} — page ${activePage.page_number}`}
                  referrerPolicy="no-referrer"
                  className="max-h-full max-w-full rounded-sm object-contain shadow-2xl"
                />
                <button
                  type="button"
                  onClick={() => move(1)}
                  disabled={activeIndex === pages.length - 1}
                  className="absolute right-0 z-10 inline-flex size-10 items-center justify-center rounded-full bg-black/45 text-white/85 transition hover:bg-black/70 disabled:opacity-25 sm:right-2"
                  aria-label="Next page"
                >
                  <ChevronRight className="size-6" />
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 pt-3">
                {pages.map((page, index) => (
                  <button
                    key={page.page_number}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      index === activeIndex
                        ? "w-6 bg-white"
                        : "w-1.5 bg-white/35 hover:bg-white/60",
                    )}
                    aria-label={`Go to page ${page.page_number}`}
                    aria-current={index === activeIndex}
                  />
                ))}
              </div>
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
