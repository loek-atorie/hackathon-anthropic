import asyncio
import json
from datetime import datetime
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

app = FastAPI(title="Scammer's Mirror Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory event queue — all tracks publish here, SSE consumers read from it
_subscribers: list[asyncio.Queue] = []


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
    payload = {"ts": datetime.utcnow().isoformat(), **event}
    for q in _subscribers:
        await q.put(payload)
    return {"queued": len(_subscribers)}


@app.get("/health")
async def health():
    return {"status": "ok", "subscribers": len(_subscribers), "ts": datetime.utcnow().isoformat()}
