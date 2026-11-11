"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  addRecent,
  clearRecents,
  exportLibrary,
  findSavedBySource,
  importLibrary,
  listRecents,
  listSavedArticles,
  removeArticle,
  removeRecent,
  saveArticle,
  updateArticle,
  type RecentAnalysis,
  type SavedArticle,
} from "@/lib/library-db";
import type { AnalysisResult } from "@/types/api";

interface LibraryContextValue {
  saved: SavedArticle[];
  recents: RecentAnalysis[];
  ready: boolean;
  unavailable: boolean;
  refresh: () => Promise<void>;
  save: (result: AnalysisResult) => Promise<SavedArticle>;
  isSaved: (sourceUrl: string) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
  update: (
    id: string,
    updates: Partial<Pick<SavedArticle, "tags" | "note">>,
  ) => Promise<SavedArticle | undefined>;
  remember: (result: AnalysisResult) => Promise<void>;
  forgetRecent: (id: string) => Promise<void>;
  clearRecentHistory: () => Promise<void>;
  exportAll: () => Promise<string>;
  importAll: (raw: string) => Promise<number>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedArticle[]>([]);
  const [recents, setRecents] = useState<RecentAnalysis[]>([]);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [articles, recent] = await Promise.all([listSavedArticles(), listRecents()]);
      setSaved(articles);
      setRecents(recent);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (result: AnalysisResult) => {
      const article = await saveArticle(result);
      await refresh();
      return article;
    },
    [refresh],
  );

  const isSaved = useCallback(async (sourceUrl: string) => {
    const found = await findSavedBySource(sourceUrl);
    return Boolean(found);
  }, []);

  const remove = useCallback(
    async (id: string) => {
      await removeArticle(id);
      await refresh();
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, updates: Partial<Pick<SavedArticle, "tags" | "note">>) => {
      const updated = await updateArticle(id, updates);
      await refresh();
      return updated;
    },
    [refresh],
  );

  const remember = useCallback(
    async (result: AnalysisResult) => {
      await addRecent(result);
      await refresh();
    },
    [refresh],
  );

  const forgetRecent = useCallback(
    async (id: string) => {
      await removeRecent(id);
      await refresh();
    },
    [refresh],
  );

  const clearRecentHistory = useCallback(async () => {
    await clearRecents();
    await refresh();
  }, [refresh]);

  const exportAll = useCallback(() => exportLibrary(), []);

  const importAll = useCallback(
    async (raw: string) => {
      const count = await importLibrary(raw);
      await refresh();
      return count;
    },
    [refresh],
  );

  const value = useMemo<LibraryContextValue>(
    () => ({
      saved,
      recents,
      ready,
      unavailable,
      refresh,
      save,
      isSaved,
      remove,
      update,
      remember,
      forgetRecent,
      clearRecentHistory,
      exportAll,
      importAll,
    }),
    [
      saved,
      recents,
      ready,
      unavailable,
      refresh,
      save,
      isSaved,
      remove,
      update,
      remember,
      forgetRecent,
      clearRecentHistory,
      exportAll,
      importAll,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) throw new Error("useLibrary must be used within LibraryProvider");
  return context;
}
