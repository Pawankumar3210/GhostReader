"use client";

import type { ReaderTheme } from "@/hooks/use-reader-preferences";
import { cn } from "@/lib/utils";

const themes: { value: ReaderTheme; label: string }[] = [
  { value: "paper", label: "Paper" },
  { value: "sepia", label: "Sepia" },
  { value: "night", label: "Night" },
];

export function ReaderThemePicker({
  value,
  onChange,
  className,
}: {
  value: ReaderTheme;
  onChange: (theme: ReaderTheme) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      aria-label="Reading theme"
      role="group"
    >
      {themes.map((theme) => (
        <button
          key={theme.value}
          type="button"
          onClick={() => onChange(theme.value)}
          className="reader-chip inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px]"
          data-active={value === theme.value}
          aria-pressed={value === theme.value}
          title={`${theme.label} theme`}
        >
          <span
            className={cn(
              "size-2.5 rounded-full border",
              theme.value === "paper" && "border-[#d8cbb8] bg-[#f4efe6]",
              theme.value === "sepia" && "border-[#c9ad83] bg-[#efe1c8]",
              theme.value === "night" && "border-[#4a4238] bg-[#141310]",
            )}
          />
          <span className="hidden sm:inline">{theme.label}</span>
        </button>
      ))}
    </div>
  );
}
