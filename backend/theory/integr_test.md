 Open 3 terminals in WSL.

  ---
  Terminal 1 — Start the server:
  cd /home/pskpe/hackathon-anthropic/backend && set -a && source .env &&
   set +a && PYTHONPATH=/home/pskpe/hackathon-anthropic/backend
  .venv/bin/uvicorn main:app --reload --port 8000

  ---
  Terminal 2 — Watch the SSE stream (leave this open):
  curl -N http://localhost:8000/events
  You should see: data: {"type": "connected"} immediately.

  ---
  Terminal 3 — Send a scam transcript:
  curl -s -X POST http://localhost:8000/ingest \
    -H "Content-Type: application/json" \
    -d '{"call_id": "live-test-001", "text": "Goedemiddag, u spreekt met
   ING beveiligingsdienst. Er is 4800 euro gestolen van uw rekening. U
  moet nu overmaken naar NL91ABNA0417164300. Bel terug op 020-1234567.
  Dit is code rood."}'

  ---
  What you should see in Terminal 2 within ~10 seconds:

  data: {"type": "extraction", "call_id": "live-test-001", "is_scam":
  true, ...}
  data: {"type": "graph_update", "call_id": "live-test-001",
  "files_written": [...]}
  data: {"type": "interrogator_hint", "call_id": "live-test-001",
  "hint": "...Dutch question..."}

  Check vault files were created:
  ls /home/pskpe/hackathon-anthropic/vault/calls/
  ls /home/pskpe/hackathon-anthropic/vault/ibans/