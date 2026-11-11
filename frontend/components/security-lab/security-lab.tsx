"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Eye,
  FileText,
  FlaskConical,
  Globe,
  Loader2,
  Lock,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ScenarioInfo, ScenarioRunResult } from "@/types/api";

const icons: Record<string, React.ElementType> = {
  "public-content": Globe,
  "client-side-restriction": Radio,
  "server-side-protection": Lock,
  "metadata-exposure": Eye,
  "secure-document-delivery": FileText,
};

const guardrails = [
  "Every scenario runs against local synthetic fixtures.",
  "No third-party site, API or document is contacted.",
  "Results are explanatory evidence, not an attack tutorial.",
  "Nothing is written outside the temporary job directory.",
];

export function SecurityLab() {
  const reduce = useReducedMotion();
  const [scenarios, setScenarios] = useState<ScenarioInfo[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, ScenarioRunResult>>({});
  const [runError, setRunError] = useState<string | null>(null);

  async function loadScenarios() {
    setListError(null);
    try {
      const items = await api.listScenarios();
      setScenarios(items);
      setActiveId((current) => current ?? items[0]?.id ?? null);
    } catch (cause) {
      setListError(
        cause instanceof ApiError ? cause.message : "The Security Lab could not be loaded.",
      );
    }
  }

  useEffect(() => {
    void loadScenarios();
  }, []);

  const active = scenarios?.find((scenario) => scenario.id === activeId) ?? null;
  const result = activeId ? results[activeId] : undefined;

  async function runScenario() {
    if (!active) return;
    setRunning(true);
    setRunError(null);
    try {
      const outcome = await api.runScenario(active.id);
      setResults((current) => ({ ...current, [active.id]: outcome }));
    } catch (cause) {
      setRunError(cause instanceof ApiError ? cause.message : "The scenario could not be run.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[380px]"
      />
      <div className="container-editorial relative py-12 md:py-16">
        <PageHeading
          eyebrow="Defensive playground"
          title={
            <>
              Break nothing.
              <br />
              Understand <span className="italic text-accent">everything.</span>
            </>
          }
          description="Five guided scenarios that show how Ghost Reader draws its boundaries: what is public, what is protected, what is metadata and what must never become an open proxy."
        />

        <div className="mt-9 flex flex-col gap-4 rounded-2xl border border-forest/20 bg-forest p-5 text-white md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#a9c9b4]">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">A lab with the doors bolted shut.</p>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-white/55">
                These scenarios execute entirely on Ghost Reader&apos;s backend with synthetic
                content. They illustrate defensive distinctions — never third-party behaviour.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-[9px] uppercase tracking-[0.16em] text-white/55">
            Local fixtures only
          </span>
        </div>

        {listError ? (
          <div className="mt-8 rounded-2xl border border-accent/25 bg-accent-soft/50 p-6">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 text-accent" />
              <div>
                <p className="text-sm font-medium text-ink">{listError}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  The Security Lab needs the Ghost Reader analysis service. Start the backend and
                  try again.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => void loadScenarios()}
                >
                  <RefreshCw className="size-3.5" /> Retry
                </Button>
              </div>
            </div>
          </div>
        ) : !scenarios ? (
          <div className="mt-8 grid gap-5 lg:grid-cols-[300px_1fr]">
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-[420px] w-full rounded-2xl" />
          </div>
        ) : (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside>
              <div className="space-y-1.5">
                {scenarios.map((scenario, index) => {
                  const Icon = icons[scenario.id] ?? FlaskConical;
                  const isActive = scenario.id === activeId;
                  const done = results[scenario.id];
                  return (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => {
                        setActiveId(scenario.id);
                        setRunError(null);
                      }}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                        isActive
                          ? "border-ink/20 bg-paper-soft shadow-card"
                          : "border-transparent hover:border-line hover:bg-paper-soft/60",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg text-[10px] font-semibold",
                          isActive ? "bg-ink text-paper" : "bg-paper-deep text-ink-muted",
                        )}
                      >
                        {done ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : (
                          String(index + 1).padStart(2, "0")
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 block text-xs font-medium leading-snug text-ink">
                          {scenario.title}
                        </span>
                        <span className="mt-0.5 block text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                          {scenario.category}
                        </span>
                      </span>
                      <Icon className="ml-auto size-3.5 shrink-0 text-ink-muted/50" />
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl border border-line bg-paper p-4">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  <ShieldCheck className="size-3.5 text-forest-light" /> Lab guardrails
                </p>
                <ul className="mt-3 space-y-2">
                  {guardrails.map((guardrail) => (
                    <li
                      key={guardrail}
                      className="flex gap-2 text-[11px] leading-relaxed text-ink-soft"
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-forest-light" />
                      {guardrail}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>

            {active && (
              <section className="overflow-hidden rounded-2xl border border-line bg-paper-soft shadow-card">
                <div className="border-b border-line p-6 md:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                      <FlaskConical className="size-3.5" /> {active.category}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                      {active.id}
                    </span>
                  </div>
                  <h2 className="mt-4 max-w-xl font-serif text-[clamp(1.7rem,3.4vw,2.4rem)] leading-[1.05] text-ink">
                    {active.title}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
                    {active.summary}
                  </p>

                  <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2.5">
                      <Terminal className="size-3.5 text-ink-muted" />
                      <span className="font-mono text-[11px] text-ink-soft">
                        {active.expected_result}
                      </span>
                    </div>
                    <Button size="sm" onClick={() => void runScenario()} disabled={running}>
                      {running ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                      {running ? "Running locally…" : result ? "Run again" : "Run scenario"}
                    </Button>
                  </div>

                  {runError && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-accent/25 bg-accent-soft/50 px-4 py-3 text-xs text-accent-dark">
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                      {runError}
                    </div>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  {result ? (
                    <motion.div
                      key={active.id}
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="p-6 md:p-8"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-2 rounded-full border border-forest/25 bg-forest-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-forest">
                          <CheckCircle2 className="size-3" /> Scenario complete
                        </span>
                        {result.simulated_status && (
                          <span className="font-mono text-[10px] text-ink-muted">
                            SIMULATED HTTP {result.simulated_status}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-ink-muted">
                          {result.duration_ms} ms
                        </span>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-line bg-paper p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                            Expected
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                            {result.expected}
                          </p>
                        </div>
                        <div className="rounded-xl border border-forest/25 bg-forest-soft/40 p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-forest">
                            Observed
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                            {result.observed}
                          </p>
                        </div>
                      </div>

                      <p className="mt-5 text-sm leading-relaxed text-ink-soft">
                        {result.explanation}
                      </p>

                      {result.evidence.length > 0 && (
                        <div className="mt-5 overflow-hidden rounded-xl border border-line bg-[#16241d] font-mono text-[11px] text-white/70">
                          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
                            <span className="size-1.5 rounded-full bg-[#d27a5f]" />
                            <span className="size-1.5 rounded-full bg-[#c6a45c]" />
                            <span className="size-1.5 rounded-full bg-[#7d9e88]" />
                            <span className="ml-2 text-[9px] uppercase tracking-[0.14em] text-white/35">
                              evidence
                            </span>
                          </div>
                          <ul className="space-y-1.5 p-4">
                            {result.evidence.map((item, index) => (
                              <li key={index} className="flex gap-2">
                                <span className="text-[#89b39a]">→</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-5 grid gap-5 md:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                            Security implications
                          </p>
                          <ul className="mt-2.5 space-y-2">
                            {result.security_implications.map((item) => (
                              <li
                                key={item}
                                className="flex gap-2 text-xs leading-relaxed text-ink-soft"
                              >
                                <CircleAlert className="mt-0.5 size-3 shrink-0 text-gold" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                            Mitigation
                          </p>
                          <ul className="mt-2.5 space-y-2">
                            {result.mitigation.map((item) => (
                              <li
                                key={item}
                                className="flex gap-2 text-xs leading-relaxed text-ink-soft"
                              >
                                <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-forest-light" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <p className="mt-5 text-[10px] leading-relaxed text-ink-muted">
                        {result.safe_note}
                      </p>

                      <details className="group mt-5 border-t border-line pt-4">
                        <summary className="flex cursor-pointer list-none items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                          Raw response{" "}
                          <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                        </summary>
                        <pre className="mt-3 max-h-72 overflow-auto rounded-xl border border-line bg-paper p-4 font-mono text-[10px] leading-relaxed text-ink-soft">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </details>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={false}
                      className="border-t border-line p-6 md:p-8"
                    >
                      <p className="eyebrow">What this demonstrates</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <ul className="space-y-2.5">
                            {active.security_implications.map((item) => (
                              <li
                                key={item}
                                className="flex gap-2 text-xs leading-relaxed text-ink-soft"
                              >
                                <CircleAlert className="mt-0.5 size-3 shrink-0 text-gold" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <ul className="space-y-2.5">
                            {active.mitigation.map((item) => (
                              <li
                                key={item}
                                className="flex gap-2 text-xs leading-relaxed text-ink-soft"
                              >
                                <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-forest-light" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <p className="mt-6 flex items-center gap-2 border-t border-line pt-4 text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                        <Play className="size-3" /> Run the scenario to see local evidence
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
