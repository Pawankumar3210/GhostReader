import { describe, expect, it } from "vitest";

import {
  formatBytes,
  formatEditionLength,
  hostname,
  isValidWebUrl,
  normaliseInputUrl,
  truncate,
} from "@/lib/utils";

describe("URL helpers", () => {
  it("adds https to bare hostnames", () => {
    expect(normaliseInputUrl("example.com/story")).toBe("https://example.com/story");
    expect(normaliseInputUrl("  https://example.com  ")).toBe("https://example.com");
  });

  it("accepts only http and https URLs", () => {
    expect(isValidWebUrl("example.com")).toBe(true);
    expect(isValidWebUrl("https://example.com/a?b=1")).toBe(true);
    expect(isValidWebUrl("javascript:alert(1)")).toBe(false);
    expect(isValidWebUrl("file:///etc/passwd")).toBe(false);
    expect(isValidWebUrl("not a url")).toBe(false);
  });

  it("extracts a readable hostname", () => {
    expect(hostname("https://www.theguardian.com/world/2026")).toBe("theguardian.com");
    expect(hostname("not-a-url")).toBe("not-a-url");
  });
});

describe("formatting helpers", () => {
  it("formats bytes across units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("truncates with an ellipsis", () => {
    expect(truncate("A short sentence", 40)).toBe("A short sentence");
    expect(truncate("A long sentence that must be shortened", 12)).toBe("A long sente…");
  });
});

describe("edition length", () => {
  function page(pageNumber: number) {
    return {
      page_number: pageNumber,
      image_url: `https://publisher.example.com/page-${pageNumber}.avif`,
      proxy_url: null,
      label: null,
      alt: null,
    };
  }

  const newspaper = {
    newspaper_pages: [page(1)],
    reading_time_minutes: 0,
    word_count: 0,
  };

  it("uses page counts for newspaper editions", () => {
    expect(formatEditionLength(newspaper)).toBe("1 page");
    expect(
      formatEditionLength({
        ...newspaper,
        newspaper_pages: [page(1), page(2)],
      }),
    ).toBe("2 pages");
  });

  it("keeps reading time and words for article editions", () => {
    expect(
      formatEditionLength({ newspaper_pages: [], reading_time_minutes: 5, word_count: 912 }),
    ).toBe("5 min read · 912 words");
  });
});
