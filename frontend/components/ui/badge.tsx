import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
  {
    variants: {
      variant: {
        default: "border-line bg-paper-deep text-ink-soft",
        accent: "border-accent/25 bg-accent-soft text-accent-dark",
        forest: "border-forest/20 bg-forest-soft text-forest",
        gold: "border-gold/30 bg-gold-soft text-gold",
        outline: "border-ink/20 bg-transparent text-ink-soft",
        night: "border-white/15 bg-white/10 text-white/80",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
