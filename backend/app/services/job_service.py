from __future__ import annotations

import asyncio
import logging
import threading
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.core.errors import AppError, NotFoundError
from app.schemas.analysis import AnalysisResult
from app.schemas.documents import DocumentResult
from app.schemas.enums import JobStatus
from app.schemas.jobs import AnalysisJobResponse, DocumentJobResponse, JobError, JobRecord
from app.services.article_analyzer import ArticleAnalyzer
from app.services.document_processor import (
    DocumentProcessor,
    InspectedDocument,
    ProcessingCancelled,
)
from app.services.job_store import JobStore, MemoryJobStore
from app.services.url_validator import URLValidator
from app.utils.files import ensure_within_directory

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(UTC)


class LocalJobRunner:
    def __init__(self, max_concurrency: int = 2) -> None:
        self._semaphore = asyncio.Semaphore(max(1, max_concurrency))
        self._tasks: dict[str, asyncio.Task[None]] = {}

    async def launch(self, job_id: str, coroutine: Any) -> None:
        task = asyncio.create_task(self._run(job_id, coroutine))
        self._tasks[job_id] = task

        def _done(_task: asyncio.Task[None]) -> None:
            self._tasks.pop(job_id, None)

        task.add_done_callback(_done)

    async def _run(self, job_id: str, coroutine: Any) -> None:
        try:
            async with self._semaphore:
                await coroutine
        except asyncio.CancelledError:
            raise
        except Exception:  # pragma: no cover - defensive logging
            logger.exception("Background job %s crashed", job_id)

    def cancel(self, job_id: str, *, cancel_task: bool) -> None:
        if cancel_task:
            task = self._tasks.get(job_id)
            if task and not task.done():
                task.cancel()

    async def shutdown(self) -> None:
        tasks = list(self._tasks.values())
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)


class StageReporter:
    def __init__(self, service: JobService, job_id: str, loop: asyncio.AbstractEventLoop) -> None:
        self.service = service
        self.job_id = job_id
        self.loop = loop
        self.finished = False

    def stage(self, message: str, progress: float | None = None) -> None:
        if self.finished:
            return
        try:
            future = asyncio.run_coroutine_threadsafe(
                self.service._stage_from_reporter(self, message, progress), self.loop
            )
            future.add_done_callback(lambda fut: fut.exception())
        except RuntimeError:
            return

    def finish(self) -> None:
        self.finished = True


class JobService:
    def __init__(
        self,
        *,
        settings: Settings,
        store: JobStore,
        analyzer: ArticleAnalyzer,
        documents: DocumentProcessor,
        validator: URLValidator,
        runner: LocalJobRunner,
    ) -> None:
        self.settings = settings
        self.store = store
        self.analyzer = analyzer
        self.documents = documents
        self.validator = validator
        self.runner = runner
        self._locks: dict[str, asyncio.Lock] = {}
        self._cancel_events: dict[str, threading.Event] = {}
        self._cleanup_task: asyncio.Task[None] | None = None

    @property
    def queue_enabled(self) -> bool:
        return self.settings.use_worker_queue

    def _lock(self, job_id: str) -> asyncio.Lock:
        lock = self._locks.get(job_id)
        if lock is None:
            lock = asyncio.Lock()
            self._locks[job_id] = lock
        return lock

    def _expires_at(self) -> datetime:
        return _utcnow() + timedelta(seconds=self.settings.job_ttl_seconds)

    async def _update(self, job_id: str, **fields: Any) -> JobRecord | None:
        async with self._lock(job_id):
            record = await self.store.get(job_id)
            if record is None:
                return None
            for key, value in fields.items():
                setattr(record, key, value)
            record.updated_at = _utcnow()
            await self.store.put(record)
            return record

    async def _stage(self, job_id: str, message: str, progress: float | None = None) -> None:
        await self._update(job_id, stage=message, progress=progress)

    async def _stage_from_reporter(
        self, reporter: StageReporter, message: str, progress: float | None
    ) -> None:
        if reporter.finished:
            return
        await self._stage(reporter.job_id, message, progress)

    async def create_analysis_job(self, url: str, *, prefer_browser: bool = False) -> AnalysisJobResponse:
        validated = await self.validator.validate(url)
        job_id = uuid.uuid4().hex
        now = _utcnow()
        record = JobRecord(
            job_id=job_id,
            kind="analysis",
            status=JobStatus.QUEUED,
            stage="Queued for analysis",
            created_at=now,
            updated_at=now,
            expires_at=self._expires_at(),
            meta={"url": validated.url, "prefer_browser": prefer_browser},
        )
        await self.store.put(record)
        if self.queue_enabled:
            await self.store.enqueue(
                {
                    "kind": "analysis",
                    "job_id": job_id,
                    "url": validated.url,
                    "prefer_browser": prefer_browser,
                }
            )
        else:
            await self.runner.launch(
                job_id,
                self._run_analysis(job_id, validated.url, prefer_browser=prefer_browser),
            )
        return self._analysis_response(record)

    async def create_document_job(
        self,
        inspected: InspectedDocument,
        *,
        requested_languages: list[str],
    ) -> DocumentJobResponse:
        job_id = uuid.uuid4().hex
        now = _utcnow()
        record = JobRecord(
            job_id=job_id,
            kind="document",
            status=JobStatus.QUEUED,
            stage="Queued for document processing",
            created_at=now,
            updated_at=now,
            expires_at=self._expires_at(),
            meta={
                "file_path": str(inspected.file_path),
                "file_name": inspected.file_name,
                "mime_type": inspected.mime_type,
                "requested_languages": requested_languages,
            },
        )
        await self.store.put(record)
        if self.queue_enabled:
            await self.store.enqueue(
                {
                    "kind": "document",
                    "job_id": job_id,
                    "file_path": str(inspected.file_path),
                    "file_name": inspected.file_name,
                    "requested_languages": requested_languages,
                }
            )
        else:
            await self.runner.launch(job_id, self._run_document(job_id))
        return self._document_response(record)

    async def get_analysis_job(self, job_id: str) -> AnalysisJobResponse:
        record = await self.store.get(job_id)
        if record is None or record.kind != "analysis":
            raise NotFoundError(
                "This analysis session was not found or has expired.",
                code="JOB_NOT_FOUND",
            )
        return self._analysis_response(record)

    async def get_document_job(self, job_id: str) -> DocumentJobResponse:
        record = await self.store.get(job_id)
        if record is None or record.kind != "document":
            raise NotFoundError(
                "This document session was not found or has expired.",
                code="JOB_NOT_FOUND",
            )
        return self._document_response(record)

    async def delete_job(self, job_id: str) -> bool:
        async with self._lock(job_id):
            record = await self.store.get(job_id)
            if record is None:
                return False
            await self.store.request_cancel(job_id)
            if record.kind == "document":
                event = self._cancel_events.get(job_id)
                if event is not None:
                    event.set()
                self.runner.cancel(job_id, cancel_task=False)
            else:
                self.runner.cancel(job_id, cancel_task=True)
            await self.store.delete(job_id)
            if record.kind == "document":
                path = record.meta.get("file_path")
                if path:
                    self._remove_file(Path(path))
            return True

    async def get_document_file(self, job_id: str) -> tuple[Path, str, str]:
        record = await self.store.get(job_id)
        if record is None or record.kind != "document":
            raise NotFoundError("The document is no longer available.", code="DOCUMENT_NOT_FOUND")
        raw_path = record.meta.get("file_path")
        if not raw_path:
            raise NotFoundError("The document file is unavailable.", code="DOCUMENT_NOT_FOUND")
        try:
            path = ensure_within_directory(Path(raw_path), self.settings.storage_path)
        except AppError as exc:
            raise NotFoundError("The document file is unavailable.", code="DOCUMENT_NOT_FOUND") from exc
        if not path.exists():
            raise NotFoundError("The document file has expired.", code="DOCUMENT_NOT_FOUND")
        mime = record.meta.get("mime_type") or "application/octet-stream"
        name = record.meta.get("file_name") or path.name
        return path, name, mime

    async def _run_analysis(self, job_id: str, url: str, *, prefer_browser: bool = False) -> None:
        record = await self._update(
            job_id, status=JobStatus.PROCESSING, stage="Starting URL analysis", progress=0.02
        )
        if record is None:
            return

        async def on_stage(message: str, progress: float | None) -> None:
            await self._stage(job_id, message, progress)

        try:
            result = await self.analyzer.analyze(url, prefer_browser=prefer_browser, on_stage=on_stage)
        except asyncio.CancelledError:
            raise
        except AppError as exc:
            await self._finalize_failed(job_id, exc.code, exc.message)
            return
        except Exception:
            logger.exception("Unexpected analysis failure for job %s", job_id)
            await self._finalize_failed(
                job_id,
                "ANALYSIS_FAILED",
                "The analysis could not be completed because of an unexpected internal error.",
            )
            return
        await self._finalize_analysis(job_id, result)

    async def run_queued_analysis(self, job_id: str, url: str, *, prefer_browser: bool = False) -> None:
        await self._run_analysis(job_id, url, prefer_browser=prefer_browser)

    async def run_queued_document(self, job_id: str, *, cancel_event: threading.Event | None = None) -> None:
        await self._run_document(job_id, cancel_event=cancel_event)

    async def _run_document(self, job_id: str, *, cancel_event: threading.Event | None = None) -> None:
        record = await self._update(
            job_id,
            status=JobStatus.PROCESSING,
            stage="Preparing document processing",
            progress=0.02,
        )
        if record is None:
            return
        path = Path(record.meta.get("file_path", ""))
        file_name = record.meta.get("file_name", "document")
        languages = record.meta.get("requested_languages") or self.settings.requested_ocr_languages

        cancel_event = cancel_event or threading.Event()
        self._cancel_events[job_id] = cancel_event
        loop = asyncio.get_running_loop()
        reporter = StageReporter(self, job_id, loop)

        def on_stage(message: str, progress: float | None) -> None:
            reporter.stage(message, progress)

        def cancel_check() -> bool:
            return cancel_event.is_set()

        try:
            inspected = await asyncio.to_thread(self.documents.inspect, path, file_name)
            result = await asyncio.to_thread(
                self.documents.process,
                inspected,
                requested_languages=languages,
                on_stage=on_stage,
                cancel_check=cancel_check,
            )
        except ProcessingCancelled:
            reporter.finish()
            await self._finalize_cancelled(job_id)
            self._remove_file(path)
            return
        except asyncio.CancelledError:
            reporter.finish()
            raise
        except AppError as exc:
            reporter.finish()
            await self._finalize_failed(job_id, exc.code, exc.message)
            self._remove_file(path)
            return
        except Exception:
            reporter.finish()
            logger.exception("Unexpected document failure for job %s", job_id)
            await self._finalize_failed(
                job_id,
                "DOCUMENT_PROCESSING_FAILED",
                "The document could not be processed because of an unexpected internal error.",
            )
            self._remove_file(path)
            return
        finally:
            self._cancel_events.pop(job_id, None)

        reporter.finish()
        await self._finalize_document(job_id, result)

    async def _finalize_analysis(self, job_id: str, result: AnalysisResult) -> None:
        await self._update(
            job_id,
            status=JobStatus.SUCCEEDED,
            stage="Analysis complete",
            progress=1.0,
            result=result.model_dump(mode="json"),
            error=None,
        )

    async def _finalize_document(self, job_id: str, result: DocumentResult) -> None:
        await self._update(
            job_id,
            status=JobStatus.SUCCEEDED,
            stage="Document processing complete",
            progress=1.0,
            result=result.model_dump(mode="json"),
            error=None,
        )

    async def _finalize_failed(self, job_id: str, code: str, message: str) -> None:
        await self._update(
            job_id,
            status=JobStatus.FAILED,
            stage="Processing failed",
            error=JobError(code=code, message=message),
        )

    async def _finalize_cancelled(self, job_id: str) -> None:
        await self._update(
            job_id,
            status=JobStatus.CANCELLED,
            stage="Processing cancelled",
        )

    def _remove_file(self, path: Path) -> None:
        try:
            if path and path.exists():
                path.unlink(missing_ok=True)
        except OSError as exc:
            logger.warning("Could not remove temporary file: %s", exc)

    async def cleanup(self) -> None:
        if isinstance(self.store, MemoryJobStore):
            await self.store.purge_expired()
        self._cleanup_files()

    def _cleanup_files(self) -> None:
        storage = self.settings.storage_path
        if not storage.exists():
            return
        cutoff = time.time() - (self.settings.job_ttl_seconds + 600)
        for entry in storage.iterdir():
            try:
                if entry.is_file() and entry.stat().st_mtime < cutoff:
                    entry.unlink(missing_ok=True)
            except OSError:
                continue

    def _analysis_response(self, record: JobRecord) -> AnalysisJobResponse:
        result: AnalysisResult | None = None
        if record.result:
            try:
                result = AnalysisResult.model_validate(record.result)
            except Exception:
                logger.exception("Stored analysis result was invalid for job %s", record.job_id)
        return AnalysisJobResponse(
            job_id=record.job_id,
            status=record.status,
            stage=record.stage,
            progress=record.progress,
            result=result,
            error=record.error,
            created_at=record.created_at,
            updated_at=record.updated_at,
            expires_at=record.expires_at,
        )

    def _document_response(self, record: JobRecord) -> DocumentJobResponse:
        result: DocumentResult | None = None
        if record.result:
            try:
                result = DocumentResult.model_validate(record.result)
            except Exception:
                logger.exception("Stored document result was invalid for job %s", record.job_id)
        return DocumentJobResponse(
            job_id=record.job_id,
            status=record.status,
            stage=record.stage,
            progress=record.progress,
            result=result,
            error=record.error,
            created_at=record.created_at,
            updated_at=record.updated_at,
            expires_at=record.expires_at,
        )

    async def close(self) -> None:
        await self.runner.shutdown()
        await self.store.close()
