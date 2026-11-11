"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn(
        "grid size-10 place-items-center rounded-full border border-line bg-paper-soft text-ink-soft transition hover:border-ink/25 hover:text-ink",
        className,
      )}
    >
      {mounted ? (
        dark ? (
          <Sun className="size-[17px]" />
        ) : (
          <Moon className="size-[17px]" />
        )
      ) : (
        <span className="size-[17px]" />
      )}
    </button>
  );
}
