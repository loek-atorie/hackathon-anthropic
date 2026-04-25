- FastAPI is a Python web server
  - SSE = a long-lived HTTP connection where the server keeps pushing
  lines of text — P3's consumers will curl -N this to receive events
  - The "bus" is an asyncio.Queue — agents drop events in one side,
  /stream drains them out the other