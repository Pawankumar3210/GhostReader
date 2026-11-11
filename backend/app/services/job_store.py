from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Protocol

from redis.asyncio import Redis

from app.core.config import Settings
from app.schemas.jobs import JobRecord

logger = logging.getLogger(__name__)

_QUEUE_KEY = "gr:jobs"
_CANCEL_PREFIX = "gr:cancel:"


class JobStore(Protocol):
    backend_name: str

    async def put(self, record: JobRecord) -> None: ...

    async def get(self, job_id: str) -> JobRecord | None: ...

    async def delete(self, job_id: str) -> None: ...

    async def request_cancel(self, job_id: str) -> None: ...

    async def is_cancelled(self, job_id: str) -> bool: ...

    async def enqueue(self, payload: dict) -> None: ...

    async def close(self) -> None: ...


class MemoryJobStore:
    backend_name = "memory"

    def __init__(self) -> None:
        self._records: dict[str, JobRecord] = {}
        self._cancelled: set[str] = set()
        self._lock = asyncio.Lock()
        self._queue: asyncio.Queue[dict] | None = None

    async def put(self, record: JobRecord) -> None:
        async with self._lock:
            self._records[record.job_id] = record

    async def get(self, job_id: str) -> JobRecord | None:
        async with self._lock:
            record = self._records.get(job_id)
            if record is None:
                return None
            if record.expires_at <= datetime.now(UTC):
                self._records.pop(job_id, None)
                return None
            return record

    async def delete(self, job_id: str) -> None:
        async with self._lock:
            self._records.pop(job_id, None)

    async def request_cancel(self, job_id: str) -> None:
        async with self._lock:
            self._cancelled.add(job_id)

    async def is_cancelled(self, job_id: str) -> bool:
        async with self._lock:
            return job_id in self._cancelled

    async def enqueue(self, payload: dict) -> None:
        if self._queue is None:
            self._queue = asyncio.Queue()
        await self._queue.put(payload)

    async def purge_expired(self) -> int:
        now = datetime.now(UTC)
        async with self._lock:
            expired = [job_id for job_id, record in self._records.items() if record.expires_at <= now]
            for job_id in expired:
                self._records.pop(job_id, None)
                self._cancelled.discard(job_id)
        return len(expired)

    async def close(self) -> None:
        return None


class RedisJobStore:
    backend_name = "redis"

    def __init__(self, settings: Settings, client: Redis) -> None:
        self.settings = settings
        self.client = client
        self._queue_key = _QUEUE_KEY

    @staticmethod
    def _key(job_id: str) -> str:
        return f"gr:job:{job_id}"

    async def put(self, record: JobRecord) -> None:
        ttl = int((record.expires_at - datetime.now(UTC)).total_seconds())
        await self.client.set(self._key(record.job_id), record.model_dump_json(), ex=max(ttl, 1))

    async def get(self, job_id: str) -> JobRecord | None:
        raw = await self.client.get(self._key(job_id))
        if not raw:
            return None
        try:
            return JobRecord.model_validate_json(raw)
        except Exception:
            logger.warning("Discarding malformed job record %s", job_id)
            await self.client.delete(self._key(job_id))
            return None

    async def delete(self, job_id: str) -> None:
        await self.client.delete(self._key(job_id))

    async def request_cancel(self, job_id: str) -> None:
        await self.client.set(f"{_CANCEL_PREFIX}{job_id}", "1", ex=max(self.settings.job_ttl_seconds, 60))

    async def is_cancelled(self, job_id: str) -> bool:
        return bool(await self.client.exists(f"{_CANCEL_PREFIX}{job_id}"))

    async def enqueue(self, payload: dict) -> None:
        await self.client.lpush(self._queue_key, json.dumps(payload))

    async def close(self) -> None:
        await self.client.aclose()


async def create_job_store(settings: Settings) -> JobStore:
    if settings.redis_url:
        try:
            client = Redis.from_url(settings.redis_url, decode_responses=True)
            await client.ping()
            logger.info("Job store connected to Redis.")
            return RedisJobStore(settings, client)
        except Exception as exc:
            if settings.use_worker_queue:
                raise RuntimeError(
                    f"Redis is required when GR_USE_WORKER_QUEUE is enabled but could not be reached: {exc}"
                ) from exc
            logger.warning("Redis unavailable, using in-memory job store: %s", exc)
    elif settings.use_worker_queue:
        raise RuntimeError("GR_USE_WORKER_QUEUE requires GR_REDIS_URL to be configured.")
    logger.info("Using in-memory job store.")
    return MemoryJobStore()
