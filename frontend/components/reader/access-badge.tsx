import { AlertTriangle, CheckCircle2, LockKeyhole, ShieldAlert, Telescope } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AccessStatus } from "@/types/api";

const config: Record<
  AccessStatus,
  {
    label: string;
    variant: "forest" | "gold" | "accent" | "default" | "outline";
    icon: React.ElementType;
  }
> = {
  PUBLIC_FULL: { label: "Public · full text", variant: "forest", icon: CheckCircle2 },
  PUBLIC_PARTIAL: { label: "Public · preview", variant: "gold", icon: Telescope },
  SUBSCRIPTION_REQUIRED: { label: "Subscription required", variant: "accent", icon: LockKeyhole },
  LOGIN_REQUIRED: { label: "Login required", variant: "accent", icon: LockKeyhole },
  ACCESS_CHALLENGE: { label: "Access challenge", variant: "gold", icon: ShieldAlert },
  JS_REQUIRED: { label: "JavaScript required", variant: "outline", icon: AlertTriangle },
  BLOCKED_BY_POLICY: { label: "Blocked by policy", variant: "accent", icon: ShieldAlert },
  UNSUPPORTED: { label: "Unsupported content", variant: "outline", icon: AlertTriangle },
  FETCH_FAILED: { label: "Fetch failed", variant: "accent", icon: AlertTriangle },
};

export function AccessBadge({ status, className }: { status: AccessStatus; className?: string }) {
  const { label, variant, icon: Icon } = config[status];
  return (
    <Badge variant={variant} className={cn("gap-1.5 normal-case tracking-[0.06em]", className)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

export function accessTone(status: AccessStatus): string {
  switch (status) {
    case "PUBLIC_FULL":
      return "border-forest/25 bg-forest-soft/70 text-forest";
    case "PUBLIC_PARTIAL":
      return "border-gold/30 bg-gold-soft/70 text-gold";
    case "SUBSCRIPTION_REQUIRED":
    case "LOGIN_REQUIRED":
    case "ACCESS_CHALLENGE":
    case "BLOCKED_BY_POLICY":
      return "border-accent/25 bg-accent-soft/60 text-accent-dark";
    default:
      return "border-line bg-paper-deep/60 text-ink-soft";
  }
}
