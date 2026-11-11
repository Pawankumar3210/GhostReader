"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const immersive =
    pathname.startsWith("/reader/") ||
    pathname.startsWith("/newspaper/") ||
    pathname === "/demo" ||
    pathname.startsWith("/demo/");

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      {!immersive && <Navbar />}
      <main id="main-content">{children}</main>
      {!immersive && <Footer />}
    </>
  );
}
