"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clock3,
  Download,
  MoreHorizontal,
  Pencil,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { GhostMark } from "@/components/layout/logo";
import { EditArticleDialog } from "@/components/library/edit-article-dialog";
import { useLibrary } from "@/components/providers/library-provider";
import { AccessBadge } from "@/components/reader/access-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
import { Skeleton } from "@/components/ui/skeleton";
import type { SavedArticle } from "@/lib/library-db";
import { cn, formatDate, hostname, newspaperPageCount, relativeTime } from "@/lib/utils";

type Sort = "recent" | "title" | "reading";

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function LibraryPage() {
  const { saved, ready, unavailable, remove, exportAll, importAll } = useLibrary();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [editing, setEditing] = useState<SavedArticle | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const tags = useMemo(
    () => Array.from(new Set(saved.flatMap((article) => article.tags))).sort(),
    [saved],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const items = saved.filter((article) => {
      const haystack = [
        article.result.title,
        article.result.publisher,
        article.result.author,
        article.result.description,
        ...article.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !needle || haystack.includes(needle);
      const matchesTag = !tag || article.tags.includes(tag);
      return matchesQuery && matchesTag;
    });
    return items.sort((a, b) => {
      if (sort === "title") {
        return (a.result.title ?? "").localeCompare(b.result.title ?? "");
      }
      if (sort === "reading") {
        return b.result.reading_time_minutes - a.result.reading_time_minutes;
      }
      return b.savedAt - a.savedAt;
    });
  }, [saved, query, tag, sort]);

  const readingMinutes = saved.reduce(
    (total, article) => total + article.result.reading_time_minutes,
    0,
  );

  async function handleExport() {
    try {
      const data = await exportAll();
      downloadFile(data, `ghost-reader-library-${new Date().toISOString().slice(0, 10)}.json`);
      setNotice(`Exported ${saved.length} edition${saved.length === 1 ? "" : "s"}.`);
    } catch {
      setError("The library could not be exported.");
    }
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const count = await importAll(text);
      setNotice(`Imported ${count} edition${count === 1 ? "" : "s"}.`);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The library could not be imported.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleRemove(article: SavedArticle) {
    await remove(article.id);
    setNotice("Edition removed from your library.");
  }

  return (
    <div className="container-editorial py-12 md:py-16">
      <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
        <PageHeading
          eyebrow="Local archive"
          title={
            <>
              The editions you <span className="italic text-accent">keep.</span>
            </>
          }
          description="A private reading shelf inside this browser. No account, no server copy, no recommendation engine — just the pages you chose to keep."
        />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport()}
            disabled={!saved.length}
          >
            <Download className="size-3.5" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <Upload className="size-3.5" /> Import
          </Button>
          <Button asChild size="sm">
            <Link href="/analyze">
              <Sparkles className="size-3.5" /> Analyze a page
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-9 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        {[
          { label: "Saved editions", value: saved.length.toString().padStart(2, "0") },
          { label: "Minutes of reading", value: readingMinutes.toString() },
          { label: "Distinct tags", value: tags.length.toString().padStart(2, "0") },
        ].map((stat) => (
          <div key={stat.label} className="bg-paper px-5 py-4">
            <p className="font-serif text-2xl text-ink">{stat.value}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-forest/20 bg-forest-soft/50 px-4 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-forest" />
        <p className="text-[11px] leading-relaxed text-forest">
          Your library lives in IndexedDB on this device. Clearing site data, using private mode or
          switching browsers will not carry it across. Export a JSON backup whenever you like.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-accent/25 bg-accent-soft/50 px-4 py-3 text-sm text-accent-dark"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-line bg-paper-soft px-4 py-3 text-sm text-ink-soft"
        >
          {notice}
        </div>
      )}

      {!ready ? (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-line p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-6 w-4/5" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : unavailable ? (
        <div className="mt-10 rounded-3xl border border-line bg-paper-soft p-10 text-center">
          <p className="font-serif text-2xl text-ink">Local storage is unavailable.</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
            Ghost Reader cannot open IndexedDB here. This can happen in strict private modes. Saved
            editions cannot be read or created in this browser session.
          </p>
        </div>
      ) : saved.length === 0 ? (
        <div className="relative mt-10 overflow-hidden rounded-3xl border border-line bg-paper-soft px-6 py-20 text-center">
          <GhostMark
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 text-accent/[0.045]"
          />
          <div className="relative mx-auto max-w-md">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
              <BookOpen className="size-6" />
            </span>
            <h2 className="mt-5 font-serif text-3xl text-ink">An empty shelf, for now.</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Analyze a public page, then press Save in the reader. Your editions will gather here —
              privately, and only on this device.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button asChild>
                <Link href="/analyze">Analyze your first page</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/demo">Try the sample</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles, authors, notes and tags"
                aria-label="Search your library"
                className="h-11 w-full rounded-full border border-line bg-paper-soft pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-accent/50 focus:ring-4 focus:ring-accent/10"
              />
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="library-sort"
                className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted"
              >
                Sort
              </label>
              <select
                id="library-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className="h-10 rounded-full border border-line bg-paper-soft px-3 text-xs text-ink outline-none focus:border-accent/50"
              >
                <option value="recent">Recently saved</option>
                <option value="title">Title A–Z</option>
                <option value="reading">Longest read</option>
              </select>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Tag className="mr-1 size-3 text-ink-muted" />
              <button
                type="button"
                onClick={() => setTag(null)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] transition",
                  !tag
                    ? "border-ink bg-ink text-paper"
                    : "border-line text-ink-muted hover:border-ink/30 hover:text-ink",
                )}
              >
                All
              </button>
              {tags.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTag(item === tag ? null : item)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
                    tag === item
                      ? "border-accent bg-accent text-white"
                      : "border-line text-ink-muted hover:border-accent/40 hover:text-accent",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-line py-16 text-center">
              <p className="font-serif text-2xl text-ink">No editions match.</p>
              <p className="mt-1 text-sm text-ink-muted">Try a different search or tag.</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setQuery("");
                  setTag(null);
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((article) => (
                <LibraryCard
                  key={article.id}
                  article={article}
                  onEdit={() => setEditing(article)}
                  onRemove={() => void handleRemove(article)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <EditArticleDialog
          article={editing}
          open={Boolean(editing)}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function LibraryCard({
  article,
  onEdit,
  onRemove,
}: {
  article: SavedArticle;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { result } = article;
  const pageCount = newspaperPageCount(result);
  const initials = (result.publisher ?? hostname(result.source_url)).slice(0, 2).toUpperCase();

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line/80 bg-paper-soft shadow-card transition-[box-shadow,transform] duration-500 hover:-translate-y-0.5 hover:shadow-lift">
      <GhostMark
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 size-32 text-accent/[0.04]"
      />

      <div className="relative flex items-start justify-between gap-3 p-5 pb-0">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-accent-soft font-serif text-xs font-semibold text-accent">
            {initials}
          </span>
          <div>
            <p className="max-w-[150px] truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {result.publisher ?? hostname(result.source_url)}
            </p>
            <p className="text-[10px] text-ink-muted/70">{relativeTime(article.savedAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <AccessBadge status={result.access_status} className="hidden 2xl:inline-flex" />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Edition actions"
                className="grid size-8 place-items-center rounded-full text-ink-muted transition hover:bg-paper-deep hover:text-ink"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="z-[80] min-w-[190px] overflow-hidden rounded-xl border border-line bg-paper-soft p-1.5 text-xs shadow-lift"
              >
                <DropdownMenu.Item
                  onSelect={onEdit}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-ink-soft outline-none data-[highlighted]:bg-paper-deep data-[highlighted]:text-ink"
                >
                  <Pencil className="size-3.5" /> Edit tags & note
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild>
                  <a
                    href={result.source_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-ink-soft outline-none data-[highlighted]:bg-paper-deep data-[highlighted]:text-ink"
                  >
                    <ArrowUpRight className="size-3.5" /> Open original
                  </a>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
                <DropdownMenu.Item
                  onSelect={onRemove}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-accent outline-none data-[highlighted]:bg-accent-soft"
                >
                  <Trash2 className="size-3.5" /> Remove from library
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <Link href={`/library/${article.id}`} className="block flex-1 p-5">
        <div className="flex flex-wrap gap-1.5">
          <AccessBadge status={result.access_status} className="2xl:hidden" />
          <Badge variant="outline" className="normal-case tracking-normal">
            {result.content_type.replaceAll("_", " ").toLowerCase()}
          </Badge>
        </div>
        <h3 className="mt-3 line-clamp-3 font-serif text-[22px] leading-[1.12] tracking-[-0.02em] text-ink transition-colors group-hover:text-accent">
          {result.title ?? "Untitled edition"}
        </h3>
        {result.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {result.description}
          </p>
        )}
        {article.note && (
          <p className="mt-3 line-clamp-2 rounded-lg border-l-2 border-gold/60 bg-gold-soft/40 px-2.5 py-1.5 text-[11px] italic text-ink-soft">
            {article.note}
          </p>
        )}
        {article.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {article.tags.slice(0, 4).map((item) => (
              <span
                key={item}
                className="rounded-full bg-paper-deep px-2 py-0.5 text-[9px] font-medium text-ink-muted"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </Link>

      <div className="flex items-center justify-between border-t border-line/70 px-5 py-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-ink-muted">
          <Clock3 className="size-3" />{" "}
          {pageCount > 0
            ? `${pageCount} ${pageCount === 1 ? "page" : "pages"}`
            : `${result.reading_time_minutes} min`}
          <span className="opacity-50">·</span>
          <span>{formatDate(result.published_at)}</span>
        </span>
        <Link
          href={`/library/${article.id}`}
          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent transition-colors hover:text-accent-dark"
        >
          Read <ArrowRight className="size-3" />
        </Link>
      </div>
    </article>
  );
}
