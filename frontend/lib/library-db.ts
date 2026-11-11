import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { AnalysisResult } from "@/types/api";

export interface SavedArticle {
  id: string;
  result: AnalysisResult;
  savedAt: number;
  tags: string[];
  note: string;
}

export interface RecentAnalysis {
  id: string;
  result: AnalysisResult;
  openedAt: number;
}

interface GhostReaderDB extends DBSchema {
  articles: {
    key: string;
    value: SavedArticle;
    indexes: { "by-source": string; "by-saved": number };
  };
  recents: {
    key: string;
    value: RecentAnalysis;
    indexes: { "by-opened": number; "by-source": string };
  };
}

const DB_NAME = "ghost-reader";
const DB_VERSION = 1;
const MAX_RECENTS = 24;

let databasePromise: Promise<IDBPDatabase<GhostReaderDB>> | null = null;

function database(): Promise<IDBPDatabase<GhostReaderDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Local storage is not available in this environment."));
  }
  databasePromise ??= openDB<GhostReaderDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const articles = db.createObjectStore("articles", { keyPath: "id" });
      articles.createIndex("by-source", "result.source_url");
      articles.createIndex("by-saved", "savedAt");
      const recents = db.createObjectStore("recents", { keyPath: "id" });
      recents.createIndex("by-opened", "openedAt");
      recents.createIndex("by-source", "result.source_url");
    },
  });
  return databasePromise;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resultKey(result: AnalysisResult): string {
  return result.canonical_url ?? result.source_url;
}

export async function listSavedArticles(): Promise<SavedArticle[]> {
  const db = await database();
  const articles = await db.getAllFromIndex("articles", "by-saved");
  return articles.sort((a, b) => b.savedAt - a.savedAt);
}

export async function findSavedBySource(sourceUrl: string): Promise<SavedArticle | undefined> {
  const db = await database();
  return db.getFromIndex("articles", "by-source", sourceUrl);
}

export async function getSavedArticle(id: string): Promise<SavedArticle | undefined> {
  const db = await database();
  return db.get("articles", id);
}

export async function saveArticle(
  result: AnalysisResult,
  options: { tags?: string[]; note?: string } = {},
): Promise<SavedArticle> {
  const db = await database();
  const existing = await db.getFromIndex("articles", "by-source", result.source_url);
  if (existing) {
    const updated: SavedArticle = {
      ...existing,
      tags: options.tags ?? existing.tags,
      note: options.note ?? existing.note,
    };
    await db.put("articles", updated);
    return updated;
  }
  const article: SavedArticle = {
    id: newId(),
    result,
    savedAt: Date.now(),
    tags: options.tags ?? [],
    note: options.note ?? "",
  };
  await db.put("articles", article);
  return article;
}

export async function updateArticle(
  id: string,
  updates: Partial<Pick<SavedArticle, "tags" | "note">>,
): Promise<SavedArticle | undefined> {
  const db = await database();
  const article = await db.get("articles", id);
  if (!article) return undefined;
  const next = { ...article, ...updates };
  await db.put("articles", next);
  return next;
}

export async function removeArticle(id: string): Promise<void> {
  const db = await database();
  await db.delete("articles", id);
}

export async function listRecents(): Promise<RecentAnalysis[]> {
  const db = await database();
  const recents = await db.getAllFromIndex("recents", "by-opened");
  return recents.sort((a, b) => b.openedAt - a.openedAt);
}

export async function addRecent(result: AnalysisResult): Promise<RecentAnalysis> {
  const db = await database();
  const existing = await db.getFromIndex("recents", "by-source", result.source_url);
  if (existing) await db.delete("recents", existing.id);
  const recent: RecentAnalysis = { id: newId(), result, openedAt: Date.now() };
  await db.put("recents", recent);
  const all = await db.getAllFromIndex("recents", "by-opened");
  if (all.length > MAX_RECENTS) {
    const excess = all.slice(0, all.length - MAX_RECENTS);
    await Promise.all(excess.map((item) => db.delete("recents", item.id)));
  }
  return recent;
}

export async function removeRecent(id: string): Promise<void> {
  const db = await database();
  await db.delete("recents", id);
}

export async function clearRecents(): Promise<void> {
  const db = await database();
  await db.clear("recents");
}

export async function exportLibrary(): Promise<string> {
  const articles = await listSavedArticles();
  return JSON.stringify(
    {
      app: "Ghost Reader",
      version: 1,
      exportedAt: new Date().toISOString(),
      articles,
    },
    null,
    2,
  );
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AnalysisResult>;
  return (
    typeof candidate.source_url === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.content)
  );
}

export async function importLibrary(raw: string): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || !("articles" in parsed)) {
    throw new Error("This file does not contain a Ghost Reader library.");
  }
  const articles = (parsed as { articles: unknown }).articles;
  if (!Array.isArray(articles)) throw new Error("The library export is malformed.");
  let imported = 0;
  for (const entry of articles) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<SavedArticle>;
    if (!isAnalysisResult(candidate.result)) continue;
    await saveArticle(candidate.result, {
      tags: Array.isArray(candidate.tags)
        ? candidate.tags.filter((tag) => typeof tag === "string")
        : [],
      note: typeof candidate.note === "string" ? candidate.note : "",
    });
    imported += 1;
  }
  return imported;
}
