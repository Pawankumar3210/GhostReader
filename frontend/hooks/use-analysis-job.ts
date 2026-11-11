"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { AnalysisJob } from "@/types/api";

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

export function useAnalysisJob(jobId: string) {
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let failures = 0;

    async function poll() {
      try {
        const next = await api.getAnalysisJob(jobId);
        if (cancelled || !mounted.current) return;
        failures = 0;
        setJob(next);
        setLoading(false);
        setError(null);
        if (!TERMINAL.has(next.status)) {
          timer = setTimeout(poll, next.status === "QUEUED" ? 850 : 1200);
        }
      } catch (cause) {
        if (cancelled || !mounted.current) return;
        failures += 1;
        if (cause instanceof ApiError && cause.status === 404) {
          setError(cause);
          setLoading(false);
          return;
        }
        if (failures >= 4) {
          setError(
            cause instanceof ApiError
              ? cause
              : new ApiError("The job could not be reached.", 0, "NETWORK_ERROR"),
          );
          setLoading(false);
          return;
        }
        timer = setTimeout(poll, 1400 * failures);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      mounted.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, attempt]);

  const remove = useCallback(async () => {
    await api.deleteAnalysisJob(jobId);
  }, [jobId]);

  return { job, error, loading, retry, remove };
}
