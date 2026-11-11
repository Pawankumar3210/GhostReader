"use client";

import { useCallback, useEffect, useState } from "react";

export type ReaderTheme = "paper" | "sepia" | "night";
export type ReaderTypeface = "serif" | "sans";

interface ReaderPreferences {
  theme: ReaderTheme;
  fontScale: number;
  measure: number;
  typeface: ReaderTypeface;
}

const STORAGE_KEY = "ghost-reader:reader-preferences";
const defaults: ReaderPreferences = {
  theme: "paper",
  fontScale: 1,
  measure: 68,
  typeface: "serif",
};

function readPreferences(): ReaderPreferences {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ReaderPreferences>;
    return {
      theme: parsed.theme === "sepia" || parsed.theme === "night" ? parsed.theme : "paper",
      fontScale:
        typeof parsed.fontScale === "number"
          ? Math.min(1.4, Math.max(0.8, parsed.fontScale))
          : defaults.fontScale,
      measure:
        typeof parsed.measure === "number"
          ? Math.min(88, Math.max(48, parsed.measure))
          : defaults.measure,
      typeface: parsed.typeface === "sans" ? "sans" : "serif",
    };
  } catch {
    return defaults;
  }
}

export function useReaderPreferences() {
  const [preferences, setPreferences] = useState<ReaderPreferences>(defaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPreferences(readPreferences());
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Partial<ReaderPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Preferences remain session-only when storage is unavailable.
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPreferences(defaults);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    } catch {
      // Ignore unavailable storage.
    }
  }, []);

  return { preferences, hydrated, update, reset };
}
