import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { AnalysisResult } from "@/types/api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function newspaperPageCount(result: Pick<AnalysisResult, "newspaper_pages">): number {
  return result.newspaper_pages?.length ?? 0;
}

export function formatEditionLength(
  result: Pick<AnalysisResult, "newspaper_pages" | "reading_time_minutes" | "word_count">,
): string {
  const pages = newspaperPageCount(result);
  if (pages > 0) return `${pages} ${pages === 1 ? "page" : "pages"}`;
  return `${result.reading_time_minutes} min read · ${result.word_count.toLocaleString()} words`;
}

export function hostname(url: string | null | undefined): string {
  if (!url) return "Unknown source";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Undated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function relativeTime(value: string | number | null | undefined): string {
  if (!value) return "";
  const timestamp = typeof value === "number" ? value : new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "";
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const thresholds: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
    [Infinity, "year"],
  ];
  let divisor = 1;
  for (const [limit, unit] of thresholds) {
    if (Math.abs(seconds) < limit) {
      return formatter.format(Math.round(seconds / divisor), unit);
    }
    divisor = limit;
  }
  return "";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function truncate(value: string, length = 160): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length).trimEnd()}…`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export function absoluteApiUrl(base: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function normaliseInputUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (!/^https?:\/\//i.test(trimmed) && !/^[a-z]+:/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function isValidWebUrl(input: string): boolean {
  try {
    const url = new URL(normaliseInputUrl(input));
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function toArabicNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}
