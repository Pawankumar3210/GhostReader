"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { HealthReport } from "@/types/api";

type State = { kind: "loading" } | { kind: "ready"; report: HealthReport } | { kind: "offline" };

export function SystemStatus({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    api
      .health()
      .then((report) => setState({ kind: "ready", report }))
      .catch(() => setState({ kind: "offline" }))
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const label =
    state.kind === "loading"
      ? "Checking engine"
      : state.kind === "offline"
        ? "Engine offline"
        : state.report.status === "ok"
          ? "Engine ready"
          : "Engine degraded";

  const tone =
    state.kind === "loading"
      ? "bg-gold"
      : state.kind === "offline"
        ? "bg-red-500"
        : state.report.status === "ok"
          ? "bg-forest-light"
          : "bg-gold";

  return (
    <div className="inline-flex items-center gap-2.5" title={compact ? label : undefined}>
      <span className="relative flex size-2">
        <span
          className={cn(
            "absolute inline-flex size-full rounded-full opacity-40",
            tone,
            state.kind !== "offline" && "animate-ping",
          )}
        />
        <span className={cn("relative inline-flex size-2 rounded-full", tone)} />
      </span>
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </span>
      {!compact && state.kind === "ready" && (
        <span className="font-mono text-[10px] text-ink-muted/70">v{state.report.version}</span>
      )}
    </div>
  );
}
