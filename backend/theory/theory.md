│    Package    │                   What it does                   │
  ├───────────────┼──────────────────────────────────────────────────┤
  │ fastapi       │ The web server framework (already installed)     │
  ├───────────────┼──────────────────────────────────────────────────┤
  │ uvicorn       │ Runs the server (already installed)              │
  ├───────────────┼──────────────────────────────────────────────────┤
  │ sse-starlette │ The SSE stream (already installed)               │
  ├───────────────┼──────────────────────────────────────────────────┤
  │ anthropic     │ This is the new one — lets your code talk to     │
  │               │ Claude AI                                        │
  ├───────────────┼──────────────────────────────────────────────────┤
  │ httpx         │ Also new — makes HTTP requests (listener uses it │
  │               │  to call /publish)                               │
  ├───────────────┼──────────────────────────────────────────────────┤
  │ pydantic      │ Data validation (already installed)              │
  └───────────────┴──────────────────────────────────────────────────┘

  Where it goes: Inside your project's isolated environment at:
  /home/pskpe/hackathon-anthropic/backend/.venv/
  This is on your WSL Linux filesystem (inside Windows, but separate
  from Windows programs). Think of it as a sandbox — these packages only
   exist for this project, nothing else on your laptop is affected.

  How big: Already at 68 MB. Adding anthropic + httpx will add roughly
  another 20–30 MB. Total ~90–100 MB when done.
===========================================

 run the extraction test:

  .venv/bin/python agents/listener.py
