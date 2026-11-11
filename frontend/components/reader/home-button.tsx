"use client";

import { Home } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

import type { ReaderTheme } from "@/hooks/use-reader-preferences";

const EXIT_DURATION_MS = 360;

export function HomeButton({ className }: { className?: string }) {
  const router = useRouter();
  const timeoutRef = useRef<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [transitionTheme, setTransitionTheme] = useState<ReaderTheme>("paper");

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (leaving) {
      event.preventDefault();
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    event.preventDefault();
    const root = event.currentTarget.closest<HTMLElement>(".reader-root");
    setTransitionTheme((root?.dataset.readerTheme as ReaderTheme | undefined) ?? "paper");
    setLeaving(true);
    timeoutRef.current = window.setTimeout(() => router.push("/"), EXIT_DURATION_MS);
  }

  return (
    <>
      <Link
        href="/"
        onClick={handleClick}
        aria-label="Home"
        title="Back to home"
        aria-busy={leaving}
        data-leaving={leaving}
        className={className ? `home-nav-button ${className}` : "home-nav-button"}
      >
        <Home className="size-4" />
        <span>Home</span>
      </Link>

      {leaving &&
        createPortal(
          <div
            className="reader-root home-transition"
            data-reader-theme={transitionTheme}
            aria-hidden
          >
            <span className="home-transition-mark">
              <Home className="size-5" />
              <span>Ghost Reader</span>
            </span>
          </div>,
          document.body,
        )}
    </>
  );
}
