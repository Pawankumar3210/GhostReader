# Architecture

Ghost Reader is split into a stateless API/worker tier and a browser-heavy reading client.

## Request flow

1. The client validates the URL for shape, then posts it to `POST /api/v1/analyze`.
2. The API validates the scheme, host, port and DNS result.
3. The robots policy is fetched and evaluated for the exact path.
4. The safe fetcher performs bounded redirects, revalidating DNS and policy at every hop.
5. Metadata, page type and access evidence are extracted.
6. trafilatura builds the article blocks and images. A conservative BeautifulSoup fallback runs only if the primary strategy finds no body.
7. Newspaper viewers are additionally scanned for publicly embedded page images. Page numbers are read from accessible labels (`Page No-N`), high-resolution sources are preferred over thumbnails, duplicates and placeholders are dropped, and the result is capped by `GR_MAX_NEWSPAPER_PAGES`.
8. Chrome-like site furniture images are pruned; article images and newspaper pages receive signed proxy URLs.
9. The job is persisted (memory or Redis) and the client polls for the result.

Uploaded documents follow the same job lifecycle but use PyMuPDF for inspection/rendering and Tesseract for pages without a text layer. Files are stored under `GR_STORAGE_DIR` with owner-only permissions.

## Production edge

The Compose stack places Caddy in front of both the frontend and API. Caddy obtains and renews TLS certificates, redirects HTTP to HTTPS, requires HTTP Basic authentication, and reverse-proxies `/api/*`, `/docs`, and `/openapi.json` to FastAPI. Everything else goes to the Next.js server. Caddy overwrites `X-Forwarded-For` with the direct peer address; only then does the API trust forwarded client identity for rate limiting.

The frontend is built with an empty `NEXT_PUBLIC_API_URL`, so browser requests stay same-origin and inherit the edge login and TLS. Direct service ports are not published.

## Observability

The API emits Prometheus metrics at `/metrics` on the private Compose network:

- `ghost_reader_http_requests_total` by method, matched route, and status.
- `ghost_reader_http_request_duration_seconds` by method and matched route.
- `ghost_reader_rate_limit_rejections_total` by route group.
- `ghost_reader_app_info` by version and environment.

Matched route templates are used instead of raw paths to avoid high-cardinality labels. Non-health requests receive an `X-Request-ID` and a structured JSON access log line. `/metrics` and the liveness probe are excluded from access logging and request metrics.

`monitoring/prometheus.yml` scrapes the API every 15 seconds; `monitoring/alerts.yml` defines downtime, 5xx rate, p95 latency, and rate-limit-spike alerts. Prometheus is bound to loopback. Alert delivery requires an Alertmanager.

## Frontend

- **Next.js App Router** with server-rendered pages and client components for the reader, polling, local library and lab.
- **No server-side user state.** Analysis results are temporary; editions are saved to IndexedDB only when the reader explicitly chooses.
- **Reader preferences** (theme, typeface, scale, measure) live in `localStorage`.
- **Newspaper editions** render a responsive page gallery with a full-screen, keyboard-navigable page viewer; the newspaper route renders the same pages as a print sequence.
- **Demo edition** is bundled locally at `lib/demo.ts`, so the reader/newspaper can be evaluated without the API.
- **API access** is centralized in `lib/api.ts`, including typed errors and media URL resolution.

## Job backends

### Memory (default)

A single API process owns the queue and records. Suitable for local use and a single container. Jobs are removed after `GR_JOB_TTL_SECONDS`.

### Redis + worker

Set `GR_REDIS_URL` and `GR_USE_WORKER_QUEUE=true`, then run `python -m app.workers.worker`. The API writes jobs and queue entries to Redis; the worker updates records and writes shared upload storage. API and worker must share `GR_SECRET_KEY` and `GR_STORAGE_DIR`; use a shared volume in Docker.

## Failure model

- Upstream failures are classified and reported as job errors, not rendered as fake article content.
- Access-protected pages preserve their access status and evidence.
- Missing OCR models set a degraded readiness state and an explicit per-page diagnostic.
- Invalid/expired jobs return a typed error and the UI explains that results are intentionally short-lived.
