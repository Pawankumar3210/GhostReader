import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/analyze", "/documents", "/library", "/security-lab", "/about", "/demo"],
        disallow: ["/reader/", "/newspaper/", "/analyze/", "/documents/", "/library/", "/recent/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
