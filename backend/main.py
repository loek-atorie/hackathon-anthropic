import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="Scammer's Mirror Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory event queue — all tracks publish here, SSE consumers read from it
_subscribers: list[asyncio.Queue] = []

# Per-call transcript accumulator — keyed by call_id, value is ordered list of chunks
_transcripts: dict[str, list[str]] = {}


async def _event_generator(queue: asyncio.Queue) -> AsyncGenerator:
    try:
        while True:
            event = await queue.get()
            yield {"data": json.dumps(event)}
    except asyncio.CancelledError:
        _subscribers.remove(queue)


@app.get("/events")
async def events():
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.append(queue)
    return EventSourceResponse(_event_generator(queue))


@app.post("/publish")
async def publish(event: dict):
    """Any internal agent calls this to broadcast an event to all SSE consumers."""
    payload = {"ts": datetime.now(timezone.utc).isoformat(), **event}
    for q in list(_subscribers):  # copy — list may mutate if subscriber disconnects mid-loop
        await q.put(payload)
    return {"queued": len(_subscribers)}


@app.post("/ingest")
async def ingest(payload: dict):
    """Accumulate transcript chunks per call. Extraction runs at call_ended, not per chunk."""
    transcript = payload.get("text", "")
    call_id = payload.get("call_id", f"call-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}")
    if not transcript.strip():
        return {"status": "ignored", "reason": "empty transcript"}
    _transcripts.setdefault(call_id, []).append(transcript)
    return {"status": "buffered", "call_id": call_id, "chunks": len(_transcripts[call_id])}


@app.post("/call_ended")
async def call_ended(payload: dict, background_tasks: BackgroundTasks):
    """Triggered by P1 when Vapi sends end-of-call-report.
    Joins the accumulated transcript buffer and runs final extraction → vault + reports.
    """
    from agents.listener import process_and_publish
    call_id = payload.get("call_id", "")
    duration_s = payload.get("duration_s", 0)
    if not call_id:
        return {"status": "ignored", "reason": "missing call_id"}

    chunks = _transcripts.pop(call_id, [])
    full_transcript = "\n".join(chunks)

    if full_transcript.strip():
        background_tasks.add_task(process_and_publish, full_transcript, call_id)
        log.info("call_ended: running extraction on %d chunks for %s", len(chunks), call_id)
    else:
        log.warning("call_ended: no transcript buffered for %s — skipping extraction", call_id)

    call_ended_event = {
        "type": "call_ended",
        "call_id": call_id,
        "duration_s": duration_s,
        "t_offset_ms": int(datetime.now(timezone.utc).timestamp() * 1000),
    }
    for q in list(_subscribers):
        await q.put(call_ended_event)
    return {"status": "ok", "call_id": call_id, "chunks": len(chunks)}


@app.get("/health")
async def health():
    return {"status": "ok", "subscribers": len(_subscribers), "ts": datetime.now(timezone.utc).isoformat()}
