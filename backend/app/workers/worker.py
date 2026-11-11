from __future__ import annotations

import asyncio
import json
import logging
import signal
import threading
from contextlib import suppress
from pathlib import Path

from redis.exceptions import TimeoutError as RedisTimeoutError

from app.api.deps import build_services
from app.core.config import get_settings
from app.services.job_store import RedisJobStore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("ghost-reader-worker")

_QUEUE_KEY = "gr:jobs"


async def _watch_cancellation(store: RedisJobStore, job_id: str, event: threading.Event) -> None:
    while not event.is_set():
        try:
            if await store.is_cancelled(job_id):
                event.set()
                return
        except Exception:
            logger.warning("Cancellation watcher lost Redis connection for job %s", job_id)
            return
        await asyncio.sleep(1.0)


def _remove_file(raw_path: str | None) -> None:
    if not raw_path:
        return
    with suppress(OSError):
        Path(raw_path).unlink(missing_ok=True)


async def run() -> None:
    settings = get_settings()
    services = await build_services(settings)
    store = services.store
    if not isinstance(store, RedisJobStore):
        await services.jobs.close()
        raise RuntimeError("The worker requires Redis. Configure GR_REDIS_URL and restart the worker.")

    stop = asyncio.Event()

    def request_stop(*_args: object) -> None:
        stop.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        with suppress(NotImplementedError):  # pragma: no cover - Windows
            loop.add_signal_handler(sig, request_stop)

    logger.info("Ghost Reader worker started and waiting for jobs.")
    try:
        while not stop.is_set():
            try:
                item = await asyncio.wait_for(store.client.brpop(_QUEUE_KEY, timeout=5), timeout=10)
            except (TimeoutError, RedisTimeoutError):
                continue
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Worker could not read from Redis: %s", exc)
                await asyncio.sleep(2)
                continue
            if not item:
                continue
            _, raw = item
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("Discarding malformed worker payload.")
                continue

            job_id = str(payload.get("job_id", ""))
            kind = payload.get("kind")
            if not job_id:
                continue
            record = await store.get(job_id)
            if record is None:
                _remove_file(payload.get("file_path"))
                continue
            if await store.is_cancelled(job_id):
                await store.delete(job_id)
                _remove_file(payload.get("file_path"))
                continue

            logger.info("Processing %s job %s", kind, job_id)
            if kind == "analysis":
                await services.jobs.run_queued_analysis(
                    job_id,
                    str(payload.get("url", "")),
                    prefer_browser=bool(payload.get("prefer_browser")),
                )
            elif kind == "document":
                cancel_event = threading.Event()
                watcher = asyncio.create_task(_watch_cancellation(store, job_id, cancel_event))
                try:
                    await services.jobs.run_queued_document(job_id, cancel_event=cancel_event)
                finally:
                    cancel_event.set()
                    watcher.cancel()
                    await asyncio.gather(watcher, return_exceptions=True)
            else:
                logger.warning("Unknown job kind %s", kind)
    finally:
        await services.jobs.close()
        logger.info("Ghost Reader worker stopped.")


def main() -> None:
    with suppress(KeyboardInterrupt):
        asyncio.run(run())


if __name__ == "__main__":
    main()
