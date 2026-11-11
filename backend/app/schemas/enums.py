from __future__ import annotations

from enum import StrEnum


class JobStatus(StrEnum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class AccessStatus(StrEnum):
    PUBLIC_FULL = "PUBLIC_FULL"
    PUBLIC_PARTIAL = "PUBLIC_PARTIAL"
    SUBSCRIPTION_REQUIRED = "SUBSCRIPTION_REQUIRED"
    LOGIN_REQUIRED = "LOGIN_REQUIRED"
    ACCESS_CHALLENGE = "ACCESS_CHALLENGE"
    JS_REQUIRED = "JS_REQUIRED"
    BLOCKED_BY_POLICY = "BLOCKED_BY_POLICY"
    UNSUPPORTED = "UNSUPPORTED"
    FETCH_FAILED = "FETCH_FAILED"


class PageType(StrEnum):
    NEWS_ARTICLE = "NEWS_ARTICLE"
    BLOG_ARTICLE = "BLOG_ARTICLE"
    GENERAL_WEBPAGE = "GENERAL_WEBPAGE"
    PDF_DOCUMENT = "PDF_DOCUMENT"
    IMAGE_DOCUMENT = "IMAGE_DOCUMENT"
    PUBLICATION_LANDING = "PUBLICATION_LANDING"
    NEWSPAPER_VIEWER = "NEWSPAPER_VIEWER"
    UNSUPPORTED = "UNSUPPORTED"


class BlockType(StrEnum):
    PARAGRAPH = "paragraph"
    HEADING = "heading"
    SUBHEADING = "subheading"
    QUOTE = "quote"
    LIST = "list"
    IMAGE = "image"
    CAPTION = "caption"
    EMBED = "embed"


class DocumentKind(StrEnum):
    PDF = "PDF_DOCUMENT"
    IMAGE = "IMAGE_DOCUMENT"


class Confidence(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
