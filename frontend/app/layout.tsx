import "@fontsource-variable/inter";
import "@fontsource-variable/newsreader";
import "@fontsource/noto-sans-kannada/400.css";
import "@fontsource/noto-sans-kannada/500.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { LibraryProvider } from "@/components/providers/library-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SiteShell } from "@/components/layout/site-shell";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Ghost Reader — Read beyond the noise",
    template: "%s · Ghost Reader",
  },
  description:
    "Ghost Reader turns publicly accessible web pages and your own documents into calm, legible reading editions — with a transparent Security Lab.",
  keywords: [
    "reader mode",
    "article extractor",
    "web reader",
    "OCR",
    "Kannada OCR",
    "security lab",
    "digital reading",
  ],
  authors: [{ name: "Ghost Reader" }],
  openGraph: {
    title: "Ghost Reader — Read beyond the noise",
    description:
      "A quieter way to read the web. Clean editions, newspaper view, document OCR and a transparent Security Lab.",
    type: "website",
    siteName: "Ghost Reader",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ghost Reader — Read beyond the noise",
    description: "A quieter way to read the web.",
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#161411" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="noise min-h-screen">
        <ThemeProvider>
          <LibraryProvider>
            <SiteShell>{children}</SiteShell>
          </LibraryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
