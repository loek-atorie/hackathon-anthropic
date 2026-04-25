curl -X POST http://localhost:8080/demo/trigger

======================

● P1 is apps/api/ — the Vapi integration layer. It does:

  - Receives webhook events from Vapi (incoming call transcripts, call
  end)
  - Normalizes them into BusEvent shape and publishes to the SSE bus
  - Exposes GET /events — the SSE stream the frontend connects to
  - Handles POST /demo/trigger to start an outbound scammer call
  - Forwards transcript chunks to P2 for Claude extraction

  Think of it as the phone/voice layer — it's the bridge between Vapi
  (the real phone call) and the rest of the system.
  ====================

  1. python3 -m venv .venv — creates a fresh isolated Python environment
   in a .venv folder inside apps/api/. Keeps dependencies separate from
  the system Python.
  2. .venv/bin/pip install -r requirements.txt — installs the packages
  listed in requirements.txt (fastapi, uvicorn, httpx, etc.) into that
  venv.
  3. .venv/bin/uvicorn main:app --port 8080 --reload — starts the P1
  server on port 8080. --reload means it auto-restarts whenever you edit
   a file.
   =========================
     Does it test anything? No — it just starts the server. But once it's
  running you can manually verify:

  # Is it alive? ********************************************88
  curl http://localhost:8080/healthz

  # Does the SSE stream open?
  curl http://localhost:8080/events

  # Does the webhook endpoint exist?
  curl -X POST http://localhost:8080/vapi/webhooks \
    -H "Content-Type: application/json" \
    -d '{"message": {"type": "transcript", "transcriptType": "final",
  "role": "user", "transcript": "Hallo", "call": {"id": "test-001"}}}'

  # Then check P1's SSE stream in another terminal to see if the event
  came through
  curl http://localhost:8080/events

  Those 3 curls confirm the whole P1 pipeline works without needing a
  real Vapi call.
=====================
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt &&
  .venv/bin/uvicorn main:app --port 8080 --reload

  Open a new terminal for the curl commands — the server terminal must
  stay open with uvicorn running.
