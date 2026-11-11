import { describe, expect, it } from "vitest";

import { API_BASE, mediaUrl } from "@/lib/api";

describe("media URLs", () => {
  it("keeps remote and local public assets intact", () => {
    expect(mediaUrl("https://cdn.example.com/photo.jpg")).toBe("https://cdn.example.com/photo.jpg");
    expect(mediaUrl("/hero-illustration.svg")).toBe("/hero-illustration.svg");
  });

  it("prefixes backend image proxy paths", () => {
    expect(mediaUrl("/api/v1/images?url=https%3A%2F%2Fexample.com&exp=1&sig=abc")).toBe(
      `${API_BASE}/api/v1/images?url=https%3A%2F%2Fexample.com&exp=1&sig=abc`,
    );
  });

  it("handles missing URLs", () => {
    expect(mediaUrl(null)).toBeUndefined();
    expect(mediaUrl(undefined)).toBeUndefined();
  });
});
