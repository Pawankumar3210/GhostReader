import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[background,color,box-shadow,transform] duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_12px_30px_-14px_rgba(141,48,27,0.7)] hover:bg-accent-dark",
        ink: "bg-ink text-paper hover:bg-ink/90",
        outline:
          "border border-ink/20 bg-transparent text-ink hover:border-ink/40 hover:bg-ink/[0.04]",
        soft: "bg-paper-deep text-ink hover:bg-line/70",
        ghost: "text-ink-soft hover:bg-ink/[0.06] hover:text-ink",
        forest: "bg-forest text-white hover:bg-forest-light",
        danger: "bg-red-700 text-white hover:bg-red-800",
      },
      size: {
        sm: "h-9 px-4 text-[13px]",
        md: "h-11 px-5",
        lg: "h-[52px] px-7 text-[15px]",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
