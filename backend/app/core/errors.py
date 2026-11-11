from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Base class for errors that are safe to expose to API clients."""

    code = "INTERNAL_ERROR"
    status_code = 500
    message = "An unexpected error occurred."

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        status_code: int | None = None,
        context: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message or self.message)
        if message:
            self.message = message
        if code:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.context = context or {}


class RequestError(AppError):
    code = "INVALID_REQUEST"
    status_code = 400
    message = "The request could not be processed."


class InvalidURL(RequestError):
    code = "INVALID_URL"
    message = "The provided URL is not valid."


class BlockedTarget(RequestError):
    code = "BLOCKED_TARGET"
    status_code = 400
    message = "The destination is not permitted by the network-safety policy."


class FetchError(AppError):
    code = "FETCH_FAILED"
    status_code = 502
    message = "The page could not be retrieved."


class DocumentError(AppError):
    code = "DOCUMENT_ERROR"
    status_code = 400
    message = "The document could not be processed."


class NotFoundError(AppError):
    code = "NOT_FOUND"
    status_code = 404
    message = "The requested resource was not found."


class RateLimitedError(AppError):
    code = "RATE_LIMITED"
    status_code = 429
    message = "Too many requests. Please wait a moment and try again."


class ServiceUnavailable(AppError):
    code = "SERVICE_UNAVAILABLE"
    status_code = 503
    message = "A required service is temporarily unavailable."
