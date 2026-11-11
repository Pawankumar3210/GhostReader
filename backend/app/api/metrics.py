from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram

HTTP_REQUESTS = Counter(
    "ghost_reader_http_requests_total",
    "HTTP requests handled by the Ghost Reader API.",
    ["method", "route", "status"],
)

HTTP_DURATION = Histogram(
    "ghost_reader_http_request_duration_seconds",
    "HTTP request duration in seconds.",
    ["method", "route"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)

RATE_LIMIT_REJECTIONS = Counter(
    "ghost_reader_rate_limit_rejections_total",
    "Requests rejected by the application rate limiter.",
    ["group"],
)

APP_INFO = Gauge(
    "ghost_reader_app_info",
    "Build and environment information for the running API.",
    ["version", "environment"],
)
