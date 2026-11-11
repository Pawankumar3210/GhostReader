from __future__ import annotations

import tempfile
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="GR_",
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Ghost Reader API"
    app_version: str = "1.0.0"
    environment: str = "development"
    debug: bool = False
    api_prefix: str = "/api/v1"
    secret_key: str = "dev-only-insecure-secret-change-me"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    redis_url: str | None = None
    use_worker_queue: bool = False
    job_ttl_seconds: int = 1800
    cleanup_interval_seconds: int = 300
    max_concurrent_jobs: int = 2

    storage_dir: str = str(Path(tempfile.gettempdir()) / "ghost-reader")

    request_timeout_seconds: float = 20.0
    connect_timeout_seconds: float = 8.0
    max_redirects: int = 5
    max_response_bytes: int = 6_000_000
    max_article_images: int = 24
    max_newspaper_pages: int = 64
    allowed_ports: str = "80,443"
    user_agent: str = "GhostReader/1.0 (public content reader; respects publisher access controls)"
    respect_robots_txt: bool = True

    enable_browser_fallback: bool = False
    browser_timeout_seconds: float = 30.0

    max_upload_bytes: int = 40_000_000
    max_json_body_bytes: int = 2_000_000
    max_pdf_pages: int = 80
    max_image_pixels: int = 45_000_000
    ocr_languages: str = "eng+kan"
    ocr_dpi: int = 250
    tesseract_cmd: str | None = None

    image_proxy_max_bytes: int = 8_000_000
    image_signature_ttl_seconds: int = 7 * 24 * 3600

    rate_limit_per_minute: int = 90
    analyze_rate_limit_per_minute: int = 20
    upload_rate_limit_per_minute: int = 12
    trust_forwarded_for: bool = False

    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def allowed_port_set(self) -> set[int]:
        ports: set[int] = set()
        for raw in self.allowed_ports.split(","):
            raw = raw.strip()
            if raw:
                try:
                    ports.add(int(raw))
                except ValueError:
                    continue
        return ports or {80, 443}

    @property
    def requested_ocr_languages(self) -> list[str]:
        return [lang.strip() for lang in self.ocr_languages.split("+") if lang.strip()]

    @property
    def storage_path(self) -> Path:
        return Path(self.storage_dir).expanduser().resolve()


@lru_cache
def get_settings() -> Settings:
    return Settings()
