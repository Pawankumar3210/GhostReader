# Security model

Ghost Reader retrieves public content and documents supplied by the reader. The security boundary is therefore both outbound (SSRF, redirects, DNS) and inbound (uploads, proxies, job records).

## Outbound requests

- Schemes are restricted to `http` and `https`.
- Ports are restricted by `GR_ALLOWED_PORTS` (default 80/443).
- Hostnames are resolved and every returned address is checked before connecting.
- Private, loopback, link-local, multicast, reserved and cloud-metadata ranges are rejected.
- DNS is re-resolved for every redirect hop; an HTTPS-to-HTTP downgrade is rejected.
- Redirect count, request time, connect time and response bytes are bounded.
- Content types are checked before parsing or proxying.
- A custom user agent identifies the reader and robots.txt is enforced by default.

Residual risk: DNS can change between validation and connection. Production deployments should also enforce an egress firewall or HTTP proxy that blocks private destinations. Do not enable `GR_TRUST_FORWARDED_FOR` unless a trusted reverse proxy overwrites the header.

## Content handling

- Parsing uses lxml/BeautifulSoup/trafilatura; scripts, styles, frames, forms and embeds are not executed.
- JSON-LD metadata is evidence only. `articleBody` is never treated as the article text.
- Embedded content is represented as a privacy notice, not an iframe.
- Retrieved article HTML is never saved to the library; only the structured result is retained in memory/Redis for the job TTL.

## Images

- Remote images are served through `/api/v1/images` with HMAC-signed URL, expiry and a strict byte/pixel limit.
- Content is verified by Pillow before delivery, and only JPEG, PNG, WebP, AVIF and GIF are accepted.
- The frontend never loads publisher images directly when a proxy URL is available.
- Image proxy links expire after seven days by default.

## Uploads

- PDF, PNG, JPEG, WebP and GIF only.
- Upload size is limited to 40 MB by default and streams are capped during write.
- PDFs are limited to 80 pages; image pixels are limited to 45 megapixels.
- Files are stored with generated names and owner-only permissions, then removed when the session ends or expires.
- OCR language codes are validated against a strict alphabetic pattern.

## Access controls

- Ghost Reader does not bypass logins, paywalls, CAPTCHAs or bot challenges.
- Access statuses and evidence are reported to the reader.
- No publisher credentials, cookies or session data are collected.
- Newspaper page URLs are used only when the publisher has already embedded them in the public viewer HTML. Ghost Reader does not mint access tokens, call private APIs, or reconstruct protected pages.
- The library is local to the browser and is not synchronized.
- The Compose deployment gates the whole application behind Caddy HTTP Basic authentication over TLS. This is a single shared credential suitable for personal or small-team deployment, not a multi-user identity system.
- The API, frontend, Redis, and worker have no published host ports in the production Compose stack.
- Application rate limits are applied per client and per route group. In-memory limits are per API process; multi-replica deployments must use a shared limiter or edge limits.

## Observability

- Every non-health request receives an `X-Request-ID` and emits a structured JSON access log.
- `/metrics` exposes Prometheus counters and latency histograms without job IDs, URLs, or other high-cardinality values.
- Prometheus binds to loopback only and scrapes the API over the private Compose network.
- Caddy protects the public edge with TLS, security headers, Basic authentication, and JSON access logs.

## Deployment checklist

- Set a strong, stable `GR_SECRET_KEY`.
- Set explicit `GR_CORS_ORIGINS` for the deployed frontend origin.
- Run behind TLS and a trusted reverse proxy; expose only Caddy.
- Set `GR_AUTH_USER` and a unique `GR_AUTH_PASSWORD_HASH`; never deploy with the example credentials.
- Enable `GR_TRUST_FORWARDED_FOR` only when the proxy overwrites `X-Forwarded-For`; the supplied Caddyfile does this.
- Add an egress firewall that denies private networks.
- Keep `GR_ENABLE_BROWSER_FALLBACK=false` unless a sandboxed browser service is maintained.
- Persist only the temporary storage volume; do not retain job data longer than the product requires.
- Monitor `/api/v1/health/ready` for storage, OCR and job-store degradation.
- Keep Prometheus on loopback or a private network; connect Alertmanager if alerts need delivery.
- Back up and protect `caddy-data` if using Caddy's internal CA; public certificates are reissued automatically.
