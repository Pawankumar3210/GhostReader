import Link from "next/link";
import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

export function GhostMark({
  className,
  detailClassName,
  ...props
}: SVGProps<SVGSVGElement> & { detailClassName?: string }) {
  return (
    <svg
      viewBox="0 0 44 44"
      role="img"
      aria-label="Ghost Reader mark"
      className={cn("size-9", className)}
      {...props}
    >
      <path
        d="M22 3.5C13.6 3.5 7.9 9.7 7.9 18.3v19.2c0 1.2 1.4 1.9 2.4 1.2l5-3.5 4.5 3.4c1.3 1 3.1 1 4.4 0l4.5-3.4 5 3.5c1 .7 2.4 0 2.4-1.2V18.3C36.1 9.7 30.4 3.5 22 3.5Z"
        fill="currentColor"
      />
      <path
        d="M14.4 18.2h5.1M24.5 18.2h5.1"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        className={cn("text-paper", detailClassName)}
      />
      <path
        d="M16.8 26.3c1.7 1.7 3.4 2.5 5.2 2.5s3.5-.8 5.2-2.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        className={cn("text-paper", detailClassName)}
        fill="none"
      />
      <path
        d="M22 8.5v6.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className={cn("text-paper/80", detailClassName)}
      />
    </svg>
  );
}

export function Logo({
  className,
  compact = false,
  light = false,
}: {
  className?: string;
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="Ghost Reader home"
      className={cn(
        "group inline-flex items-center gap-2.5 text-ink transition-opacity hover:opacity-80",
        light && "text-white",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-xl bg-accent text-white shadow-[0_10px_24px_-12px_rgba(141,48,27,0.8)] transition-transform duration-500 group-hover:-rotate-3",
          compact && "size-9",
        )}
      >
        <GhostMark className="size-[23px]" detailClassName="text-[#2a130d]" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-serif text-[21px] font-medium tracking-[-0.02em]">
          Ghost <span className="italic text-accent">Reader</span>
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-ink-muted",
              light && "text-white/55",
            )}
          >
            Read beyond the noise
          </span>
        )}
      </span>
    </Link>
  );
}
