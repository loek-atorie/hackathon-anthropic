import asyncio
import json
from typing import Any, AsyncGenerator

from fastapi.responses import StreamingResponse


class SSEBus:
    """In-memory pub/sub for transcript + extraction events.

    P2's Listener subscribes to consume transcripts.
    P3's dashboard subscribes via /events to render live.
    """

    def __init__(self) -> None:
        self._subscribers: list[asyncio.Queue] = []

    async def publish(self, event: dict[str, Any]) -> None:
        dead: list[asyncio.Queue] = []
        for q in self._subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self._subscribers.remove(q)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1024)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        if q in self._subscribers:
            self._subscribers.remove(q)


bus = SSEBus()


async def sse_stream() -> StreamingResponse:
    queue = bus.subscribe()

    async def gen() -> AsyncGenerator[str, None]:
        try:
            yield ": connected\n\n"
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            bus.unsubscribe(queue)

    return StreamingResponse(gen(), media_type="text/event-stream")
