import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-12 w-full rounded-2xl border border-line bg-paper-soft px-4 text-[15px] text-ink shadow-inset outline-none transition placeholder:text-ink-muted/70 focus:border-accent/60 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});
