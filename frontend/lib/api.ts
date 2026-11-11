import type {
  AnalysisJob,
  DocumentJob,
  HealthReport,
  ScenarioInfo,
  ScenarioRunResult,
} from "@/types/api";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown> | null;

  constructor(
    message: string,
    status: number,
    code = "REQUEST_FAILED",
    details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
  detail?:
    | string
    | Array<{ msg?: string; loc?: unknown[] }>
    | {
        code?: string;
        message?: string;
        context?: Record<string, unknown> | null;
      };
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ErrorBody | null = null;
  try {
    body = (await response.json()) as ErrorBody;
  } catch {
    body = null;
  }
  if (body?.error?.message) {
    return new ApiError(
      body.error.message,
      response.status,
      body.error.code ?? "REQUEST_FAILED",
      body.error.details ?? null,
    );
  }
  if (typeof body?.detail === "string") {
    return new ApiError(body.detail, response.status);
  }
  if (body?.detail && !Array.isArray(body.detail) && typeof body.detail === "object") {
    return new ApiError(
      body.detail.message ?? "The request could not be completed.",
      response.status,
      body.detail.code ?? "REQUEST_FAILED",
      body.detail.context ?? null,
    );
  }
  if (Array.isArray(body?.detail)) {
    const message = body.detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join(". ");
    return new ApiError(
      message || "The request could not be validated.",
      response.status,
      "VALIDATION_ERROR",
    );
  }
  return new ApiError(
    response.status === 429
      ? "Ghost Reader is receiving a lot of requests. Please try again shortly."
      : "The request could not be completed.",
    response.status,
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Ghost Reader could not reach its analysis service. Check that the backend is running.",
      0,
      "NETWORK_ERROR",
    );
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  analyze(url: string, preferBrowser = false): Promise<AnalysisJob> {
    return request<AnalysisJob>("/api/v1/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, prefer_browser: preferBrowser }),
    });
  },

  getAnalysisJob(jobId: string): Promise<AnalysisJob> {
    return request<AnalysisJob>(`/api/v1/jobs/${encodeURIComponent(jobId)}`);
  },

  deleteAnalysisJob(jobId: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`/api/v1/jobs/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    });
  },

  async uploadDocument(file: File, ocrLanguages: string[]): Promise<DocumentJob> {
    const form = new FormData();
    form.append("file", file);
    if (ocrLanguages.length) form.append("ocr_languages", ocrLanguages.join("+"));
    return request<DocumentJob>("/api/v1/documents", { method: "POST", body: form });
  },

  getDocumentJob(jobId: string): Promise<DocumentJob> {
    return request<DocumentJob>(`/api/v1/documents/${encodeURIComponent(jobId)}`);
  },

  async deleteDocumentJob(jobId: string): Promise<{ deleted: boolean }> {
    const response = await fetch(`${API_BASE}/api/v1/documents/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw await parseError(response);
    return (await response.json()) as { deleted: boolean };
  },

  documentFileUrl(jobId: string): string {
    return `${API_BASE}/api/v1/documents/${encodeURIComponent(jobId)}/file`;
  },

  listScenarios(): Promise<ScenarioInfo[]> {
    return request<ScenarioInfo[]>("/api/v1/security-lab/scenarios");
  },

  runScenario(id: string, signal?: AbortSignal): Promise<ScenarioRunResult> {
    return request<ScenarioRunResult>(
      `/api/v1/security-lab/scenarios/${encodeURIComponent(id)}/run`,
      { method: "POST", signal },
    );
  },

  health(): Promise<HealthReport> {
    return request<HealthReport>("/api/v1/health/ready");
  },
};

export function mediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:)?\/\//i.test(url)) return url;
  if (url.startsWith("/api/")) return `${API_BASE}${url}`;
  if (url.startsWith("/")) return url;
  return `${API_BASE}/${url.replace(/^\//, "")}`;
}
