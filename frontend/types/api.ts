export type JobStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type AccessStatus =
  | "PUBLIC_FULL"
  | "PUBLIC_PARTIAL"
  | "SUBSCRIPTION_REQUIRED"
  | "LOGIN_REQUIRED"
  | "ACCESS_CHALLENGE"
  | "JS_REQUIRED"
  | "BLOCKED_BY_POLICY"
  | "UNSUPPORTED"
  | "FETCH_FAILED";

export type PageType =
  | "NEWS_ARTICLE"
  | "BLOG_ARTICLE"
  | "GENERAL_WEBPAGE"
  | "PDF_DOCUMENT"
  | "IMAGE_DOCUMENT"
  | "PUBLICATION_LANDING"
  | "NEWSPAPER_VIEWER"
  | "UNSUPPORTED";

export type BlockType =
  "paragraph" | "heading" | "subheading" | "quote" | "list" | "image" | "caption" | "embed";

export type DocumentKind = "PDF_DOCUMENT" | "IMAGE_DOCUMENT";

export type Confidence = "high" | "medium" | "low";

export interface AccessAssessment {
  status: AccessStatus;
  confidence: Confidence;
  explanation: string;
  evidence: string[];
}

export interface ImageReference {
  url: string;
  proxy_url: string | null;
  caption: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
  attribution: string | null;
}

export interface NewspaperPage {
  page_number: number;
  image_url: string;
  proxy_url: string | null;
  label: string | null;
  alt: string | null;
}

export interface ContentBlock {
  type: BlockType;
  text: string | null;
  level: number | null;
  items: string[] | null;
  image_url: string | null;
  proxy_url: string | null;
  alt: string | null;
  caption: string | null;
  attribution: string | null;
}

export interface AnalysisResult {
  source_url: string;
  canonical_url: string | null;
  publisher: string | null;
  title: string | null;
  subtitle: string | null;
  author: string | null;
  published_at: string | null;
  updated_at: string | null;
  description: string | null;
  language: string | null;
  content_type: PageType;
  access_status: AccessStatus;
  content: ContentBlock[];
  images: ImageReference[];
  newspaper_pages: NewspaperPage[];
  source_metadata: Record<string, unknown>;
  access_assessment: AccessAssessment;
  word_count: number;
  reading_time_minutes: number;
  fetched_via: "http" | "browser" | "none";
  extractor: string | null;
  notes: string[];
}

export interface JobErrorPayload {
  code: string;
  message: string;
}

export interface AnalysisJob {
  job_id: string;
  kind: "analysis";
  status: JobStatus;
  stage: string;
  progress: number | null;
  result: AnalysisResult | null;
  error: JobErrorPayload | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface DocumentPage {
  page_number: number;
  width: number | null;
  height: number | null;
  has_text_layer: boolean;
  text: string;
  ocr_used: boolean;
  ocr_confidence: number | null;
  ocr_language: string | null;
  warnings: string[];
}

export interface DocumentResult {
  file_name: string;
  document_kind: DocumentKind;
  mime_type: string;
  size_bytes: number;
  page_count: number;
  pages: DocumentPage[];
  metadata: Record<string, unknown>;
  requested_ocr_languages: string[];
  used_ocr_languages: string[];
  ocr_available: boolean;
  diagnostics: string[];
  processing_notes: string[];
}

export interface DocumentJob {
  job_id: string;
  kind: "document";
  status: JobStatus;
  stage: string;
  progress: number | null;
  result: DocumentResult | null;
  error: JobErrorPayload | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface ScenarioInfo {
  id: string;
  title: string;
  category: string;
  summary: string;
  expected_result: string;
  security_implications: string[];
  mitigation: string[];
}

export interface ScenarioRunResult {
  scenario_id: string;
  title: string;
  expected: string;
  observed: string;
  evidence: string[];
  explanation: string;
  security_implications: string[];
  mitigation: string[];
  simulated_status: number | null;
  duration_ms: number;
  safe_note: string;
}

export interface HealthReport {
  status: "ok" | "degraded" | "unavailable";
  version: string;
  environment: string;
  checks: Record<string, unknown>;
}
