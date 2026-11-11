# Ghost Reader

**Read beyond the noise.** A quieter way to read the public web and your own documents.

Ghost Reader turns a public article, a digital newspaper edition, or an uploaded PDF/image into a calm reading edition: a typographic reader, a printable broadsheet, and a local-first library. It explains every access verdict, preserves provenance, and never pretends a paywall or login is something it can cross.

## What it does

- **Safe article extraction** — validates schemes, ports and DNS on every redirect, blocks private/loopback/metadata addresses, honours robots.txt, and refuses HTTPS-to-HTTP downgrades.
- **Transparent access assessment** — classifies public full text, previews, paywalls, login walls, challenges, JavaScript requirements and policy blocks, with evidence attached.
- **Reader view** — Newsreader/Inter typography, shared Paper/Sepia/Night themes, adjustable measure and type size, table of contents, scroll progress and an access report.
- **Newspaper view** — a broadsheet edition with masthead, decks, columns, matching Paper/Sepia/Night themes and print CSS.
- **Complete e-paper pages** — discovers every page image exposed by a public newspaper viewer, then presents a thumbnail gallery, keyboard-navigable full-screen reader and print-ready page sequence. AVIF, WebP, JPEG, PNG and GIF delivery is supported through the signed proxy.
- **Client-side PDF export** — exports every newspaper page in original order with a custom filename and Low, Medium or High quality. The PDF is generated and downloaded entirely in the browser.
- **Fast Home navigation** — a centered Home control in both reading views returns to the landing page with a short, reduced-motion-aware circle-wipe transition.
- **Document OCR** — preserves embedded PDF text and runs Tesseract only where a text layer is missing. English and Kannada language packs are supported, with per-page confidence and diagnostics.
- **Local-first library** — saved editions, searches, tags, notes and JSON backup in IndexedDB. No account and no server-side reading history.
- **Security Lab** — five local, synthetic scenarios showing the defensive boundaries behind the product.
- **Optional Redis jobs + browser fallback** — an isolated worker mode for production, disabled by default.

## Reading and export

Both reading views share a single Paper, Sepia and Night theme picker. The choice is stored locally and applies to the reader and the broadsheet. Print output always uses the paper treatment with a white background and dark ink, even when Night is active.

Every e-paper edition also exposes a PDF download next to Print. All pages are prepared in order with a progress indicator, while the reader chrome, article text and controls are excluded. The default filename follows the edition title and date, and `.pdf` is added automatically if it is missing.

| Quality | Image width | Approx. resolution | Best for |
| --- | --- | --- | --- |
| Low | 960 px | 116 DPI | Quick reading and smaller attachments |
| Medium | 1,800 px | 218 DPI | Everyday offline archive |
| High | Native page pixels | Full detail | Printing and archival copies |

High is selected by default. All three presets preserve the same physical PDF page dimensions. A centered Home control is available in both reading views; on mobile it moves into the top strip, and reduced-motion preferences skip the circle-wipe animation.

## Principles

1. **Consent by design.** No paywall circumvention, credential replay or challenge solving.
2. **Evidence on the record.** Access verdicts, extraction notes and OCR diagnostics travel with the edition.
3. **Local by default.** The library lives in your browser, and PDF exports are generated locally without an upload.
4. **Boring where it matters.** Validation, redirects, signatures, limits and errors are explicit.

## Architecture

```
Browser (Next.js 15)
  ├── Reader / newspaper / client-side PDF / local library (IndexedDB)
  ├── Analyze + document workspaces
  └── Security Lab
            │
            ▼
Caddy (production edge)
  ├── automatic HTTPS + HTTP→HTTPS redirect
  ├── HTTP Basic authentication
  └── reverse proxy
            │
            ▼
FastAPI service
  ├── URL validation + DNS re-resolution
  ├── robots.txt policy cache
  ├── SafeFetcher (redirect/size/content-type limits)
  ├── trafilatura extraction + conservative fallback
  ├── public newspaper page discovery
  ├── access assessment + metadata extraction
  ├── signed image proxy (AVIF/WebP/JPEG/PNG/GIF)
  ├── per-client rate limits + structured access logs
  ├── Prometheus metrics at /metrics
  └── document inspection + Tesseract OCR
            │
      ┌─────┴─────┐
      ▼           ▼
  in-memory     Redis + worker
  jobs (dev)    (optional production)
```

Temporary jobs and uploaded documents expire after 30 minutes. Storage is owner-only and processed files are removed when a session ends or expires.

## Quick start

### Prerequisites

- Python **3.12+**
- Node.js **22+**
- Tesseract OCR with `eng` and `kan` language data (required for scanned documents)
- Docker (optional, for the container stack)

On Debian/Ubuntu:

```bash
sudo apt-get install tesseract-ocr tesseract-ocr-eng tesseract-ocr-kan tesseract-ocr-osd
```

### Backend

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
# Edit .env: set GR_SECRET_KEY, confirm GR_STORAGE_DIR, adjust OCR paths if needed
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API documentation: <http://127.0.0.1:8000/docs>  
Readiness report: <http://127.0.0.1:8000/api/v1/health/ready>

The backend automatically falls back to an in-memory job store unless `GR_REDIS_URL` is set.

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://127.0.0.1:3000>. Production build:

```bash
npm run build
npm run start
```

`NEXT_PUBLIC_*` values are compiled into the client bundle. Set them before `npm run build`; changing them at runtime on an already-built image has no effect.

### Docker Compose production stack

The Compose stack runs Caddy, a Next.js frontend, FastAPI API, Redis, a background worker, and Prometheus. Caddy terminates TLS, requires a login, and is the only published application endpoint.

Prerequisites:

- A DNS name pointing at the host for automatic public certificates.
- TCP ports 80/443 and UDP 443 reachable.
- Docker Compose v2 on the deployment host.

```bash
cp .env.example .env
# Set a strong signing key.
openssl rand -hex 32
# Put the generated value in GR_SECRET_KEY, then create a password hash:
docker run --rm caddy:2.11.9-alpine \
  caddy hash-password --plaintext 'choose-a-strong-password'
```

Edit `.env` and set:

```dotenv
GR_DOMAIN=reader.example.com
GR_AUTH_USER=reader
GR_AUTH_PASSWORD_HASH='$2a$14$...'
GR_SECRET_KEY=<openssl output>
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SITE_URL=https://reader.example.com
```

Keep the bcrypt hash in single quotes so Compose does not expand its `$` characters. Leave `NEXT_PUBLIC_API_URL` empty: browser requests are same-origin and Caddy routes `/api/*` to FastAPI.

```bash
docker compose up --build -d
docker compose ps
```

Open `https://reader.example.com` and sign in with the configured username and password. The API, frontend, Redis, and worker are not published directly.

For a local smoke test, set `GR_DOMAIN=localhost`. Caddy will create an internal certificate that the host does not trust; use `curl -k` or trust Caddy's local root CA. Do not serve `localhost` as a public deployment.

The worker and API share the `ghost-storage` volume. Do not run more than one Tesseract model set against mismatched languages.

### Monitoring

Prometheus binds to `127.0.0.1:9090` only. Use an SSH tunnel for the UI:

```bash
ssh -L 9090:127.0.0.1:9090 user@reader.example.com
```

Then open <http://127.0.0.1:9090>. The API exports request counts, duration histograms, rate-limit rejections, and build info. `monitoring/alerts.yml` contains rules for API downtime, elevated 5xx rate, p95 latency, and sustained rate-limit rejections. Prometheus evaluates the rules; connect Alertmanager if you need paging or email delivery.

Structured JSON access logs, including request IDs, are available with:

```bash
docker compose logs -f backend-api
```

Caddy also writes JSON access logs, including TLS and authentication failures.

## Configuration

All backend settings use the `GR_` prefix and can be provided through the environment or `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `GR_SECRET_KEY` | development-only value | Signs image proxy URLs and must be stable across API replicas. **Set this in production.** |
| `GR_ENVIRONMENT` | `development` | Runtime label shown in health checks. |
| `GR_CORS_ORIGINS` | localhost origins | Comma-separated browser origins allowed to call the API. |
| `GR_STORAGE_DIR` | `${TMPDIR}/ghost-reader` | Temporary upload/job storage. |
| `GR_JOB_TTL_SECONDS` | `1800` | Job/result lifetime. |
| `GR_MAX_NEWSPAPER_PAGES` | `64` | Maximum public page images extracted from a newspaper viewer. |
| `GR_OCR_LANGUAGES` | `eng+kan` | Default OCR language set. |
| `GR_TESSERACT_CMD` | auto-detected | Explicit Tesseract binary path. |
| `GR_REDIS_URL` | unset | Enables Redis-backed jobs. |
| `GR_USE_WORKER_QUEUE` | `false` | Requires Redis and a running worker. |
| `GR_ENABLE_BROWSER_FALLBACK` | `false` | Enables the isolated Playwright fallback when installed. |
| `GR_TRUST_FORWARDED_FOR` | `false` | Only enable behind a trusted proxy that overwrites `X-Forwarded-For`. Compose enables it because Caddy overwrites the header. |
| `GR_RATE_LIMIT_PER_MINUTE` | `90` | Per-client limit for general API requests. |
| `GR_ANALYZE_RATE_LIMIT_PER_MINUTE` | `20` | Per-client limit for article analysis. |
| `GR_UPLOAD_RATE_LIMIT_PER_MINUTE` | `12` | Per-client limit for document uploads. |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Public API origin compiled into the frontend. Leave empty for same-origin Compose deployments. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical site origin for metadata, sitemap and robots. |

Compose-only edge settings use the same `.env` file:

| Variable | Purpose |
| --- | --- |
| `GR_DOMAIN` | Public hostname Caddy serves and obtains a certificate for. |
| `GR_AUTH_USER` | HTTP Basic authentication username. |
| `GR_AUTH_PASSWORD_HASH` | Caddy bcrypt hash generated with `caddy hash-password`. |

See `.env.example` for the full commented template.

Rate limiting is in-memory per API process. For multiple API replicas, move the limiter to a shared store such as Redis or enforce the limit at the edge.

## API surface

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/v1/analyze` | Queue a public URL analysis. |
| `GET` | `/api/v1/jobs/{id}` | Poll an analysis job. |
| `DELETE` | `/api/v1/jobs/{id}` | Cancel/remove an analysis job. |
| `POST` | `/api/v1/documents` | Upload a PDF/image and queue processing. |
| `GET` | `/api/v1/documents/{id}` | Poll document processing. |
| `GET` | `/api/v1/documents/{id}/file` | View/download the original upload. |
| `DELETE` | `/api/v1/documents/{id}` | End a document session. |
| `GET` | `/api/v1/images` | Signed image proxy. |
| `GET` | `/api/v1/security-lab/scenarios` | List local lab scenarios. |
| `POST` | `/api/v1/security-lab/scenarios/{id}/run` | Run a synthetic scenario. |
| `GET` | `/api/v1/health/live` | Liveness. |
| `GET` | `/api/v1/health/ready` | Storage, OCR, job store and fallback readiness. |
| `GET` | `/metrics` | Prometheus metrics for the internal Compose network; not proxied publicly. |

## Tests

### Backend

```bash
cd backend
./.venv/bin/ruff check app tests --output-format concise
./.venv/bin/ruff format --check app tests
./.venv/bin/pytest -q
```

The optional real Tesseract test is skipped unless a working command is provided:

```bash
GR_TEST_TESSERACT_CMD=/usr/bin/tesseract ./.venv/bin/pytest -q tests/test_documents.py
```

### Frontend

```bash
cd frontend
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

`npm run test:e2e` starts the Next dev server automatically and reuses an existing one locally. The analyze/document integration tests skip themselves when the API is unavailable; the OCR test also skips if Kannada/English Tesseract models are missing. The live e-paper test also verifies shared theme switching, exports High and Low quality PDFs, and checks their filenames, page count, page width and relative file size. Start the backend before running the full suite.

To run the suite against the production Compose edge, provide an external URL, credentials, and the public API origin:

```bash
PLAYWRIGHT_BASE_URL=https://reader.example.com \
PLAYWRIGHT_BACKEND_URL=https://reader.example.com \
PLAYWRIGHT_HTTP_USERNAME=reader \
PLAYWRIGHT_HTTP_PASSWORD='your-password' \
npm run test:e2e
```

Add `PLAYWRIGHT_IGNORE_HTTPS_ERRORS=1` for the `localhost` internal certificate. Setting `PLAYWRIGHT_BASE_URL` disables the automatic dev server.

## Safety model

- Only `http` and `https`, only ports 80/443 by default.
- DNS is resolved and checked immediately before every request and redirect hop.
- Private, loopback, link-local, reserved and cloud-metadata addresses are rejected.
- Redirect count, response size, time and content type are bounded.
- `robots.txt` is fetched and enforced before page retrieval.
- Images are fetched only through signed, expiring proxy URLs, re-validated as JPEG/PNG/WebP/AVIF/GIF, and size/pixel bounded.
- Newspaper page discovery only uses image URLs already exposed by the publisher's public viewer; no login, paywall or viewer token is bypassed.
- Metadata such as JSON-LD `articleBody` is used as evidence, never as free article text.
- Access-protected pages are reported, not circumvented.
- Uploaded files are size/page/pixel bounded, validated, and short-lived.

For production, place the API behind an egress firewall or controlled proxy. DNS validation and the actual connection are separate operations; an egress firewall closes the residual DNS-rebinding window.

## OCR notes

- Embedded PDF text is always preferred and never OCR'd over.
- Tesseract runs only for pages without a text layer or for image uploads.
- Kannada and English models are requested explicitly; missing models produce diagnostics, not silent fallback.
- OCR confidence is shown per page. Complex scripts and low-resolution scans can still contain recognition errors.
- Use 250+ DPI scans for best results.

## Known limits

- Some publishers block automated retrieval; Ghost Reader reports this instead of working around it.
- JavaScript-only pages require the optional, disabled-by-default browser fallback.
- Extraction is heuristic. Unusual page layouts can still produce imperfect blocks.
- E-paper support depends on the publisher exposing page images in the public viewer. Canvas-only, token-protected or subscriber-only viewers are reported, not circumvented.
- The local library is tied to one browser profile and one origin. Export a JSON backup before clearing site data.
- There is no user account, sync, or server-side reading history.
- The Compose login is one shared HTTP Basic credential, not multi-user authentication.
- Application rate limits are per API process; use a shared limiter or edge limits with multiple replicas.
- Redis worker mode is optional and not required for single-instance use.

## Project layout

```
backend/
  app/api/          FastAPI routes, middleware, dependencies
  app/services/     URL safety, fetching, extraction, OCR, jobs, image signing
  app/security_lab/ Synthetic defensive scenarios
  app/workers/      Redis worker
  tests/            Unit and API tests

frontend/
  app/              Next.js routes
  components/       Reader, newspaper, analyze, documents, library, lab, UI
  hooks/            Polling and reader preferences
  lib/              API client, IndexedDB, demo edition, utilities
  test/             Vitest unit/component tests
  e2e/              Playwright smoke and integration tests

deploy/             Caddy TLS + authentication edge
monitoring/         Prometheus scrape configuration and alert rules
docs/               Architecture and security notes
LICENSE             MIT license
```

## License

MIT. See [LICENSE](LICENSE).
