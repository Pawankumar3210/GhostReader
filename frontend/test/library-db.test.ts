import { beforeEach, describe, expect, it } from "vitest";

import {
  addRecent,
  clearRecents,
  exportLibrary,
  importLibrary,
  listRecents,
  listSavedArticles,
  removeArticle,
  saveArticle,
} from "@/lib/library-db";
import { demoArticle } from "@/lib/demo";
import type { AnalysisResult } from "@/types/api";

function cloneResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    ...demoArticle,
    source_url: "https://example.com/reading",
    canonical_url: "https://example.com/reading",
    title: "A test edition",
    ...overrides,
  };
}

describe("local library", () => {
  beforeEach(async () => {
    const articles = await listSavedArticles();
    await Promise.all(articles.map((article) => removeArticle(article.id)));
    await clearRecents();
  });

  it("saves, deduplicates and removes an edition", async () => {
    const first = await saveArticle(cloneResult(), { tags: ["design"] });
    const second = await saveArticle(cloneResult(), { tags: ["design", "reading"] });
    expect(second.id).toBe(first.id);
    expect(second.tags).toEqual(["design", "reading"]);

    const articles = await listSavedArticles();
    expect(articles).toHaveLength(1);
    expect(articles[0]?.result.title).toBe("A test edition");

    await removeArticle(first.id);
    expect(await listSavedArticles()).toHaveLength(0);
  });

  it("keeps a single recent entry per source", async () => {
    await addRecent(cloneResult());
    await addRecent(cloneResult({ title: "Updated title" }));
    const recents = await listRecents();
    expect(recents).toHaveLength(1);
    expect(recents[0]?.result.title).toBe("Updated title");
  });

  it("round-trips an exported library", async () => {
    await saveArticle(cloneResult(), { tags: ["essay"], note: "Reread this." });
    const exported = await exportLibrary();
    await removeArticle((await listSavedArticles())[0]!.id);
    expect(await listSavedArticles()).toHaveLength(0);

    const count = await importLibrary(exported);
    expect(count).toBe(1);
    const restored = await listSavedArticles();
    expect(restored[0]?.tags).toEqual(["essay"]);
    expect(restored[0]?.note).toBe("Reread this.");
  });

  it("rejects malformed imports", async () => {
    await expect(importLibrary("not json")).rejects.toThrow("valid JSON");
    await expect(importLibrary(JSON.stringify({ hello: "world" }))).rejects.toThrow(
      "Ghost Reader library",
    );
  });
});
