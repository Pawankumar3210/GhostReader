import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl", className)}>
      <p className="eyebrow flex items-center gap-2">
        <span className="inline-block h-px w-7 bg-accent" />
        {eyebrow}
      </p>
      <h1 className="mt-4 text-[clamp(2.4rem,5.2vw,4.2rem)] font-normal leading-[0.98] tracking-[-0.035em] text-ink">
        {title}
      </h1>
      {description && (
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{description}</p>
      )}
      {children}
    </div>
  );
}
