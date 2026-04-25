 How to use

  Start (3 terminals):
  # Terminal 1 — P2
  cd ~/hackathon-anthropic/backend && source .venv/bin/activate &&
  uvicorn main:app --port 8000 --reload

  # Terminal 2 — P1
  cd ~/hackathon-anthropic/apps/api && .venv/bin/uvicorn main:app --port
   8080 --reload

  # Terminal 3 — Frontend
  cd ~/hackathon-anthropic/frontend/web &&
  NEXT_PUBLIC_SSE_URL=http://localhost:8080/events pnpm dev

  Test without real Vapi call:
  # Send transcript
  curl -X POST http://localhost:8000/ingest -H "Content-Type:
  application/json" \
    -d '{"call_id": "test-001", "text": "ING Bank beveiligingsdienst.
  Maak uw geld over naar NL91ABNA0417164300. Code rood, hoogste
  urgentie."}'

  # Trigger end of call
  curl -X POST http://localhost:8000/call_ended -H "Content-Type:
  application/json" \
    -d '{"call_id": "test-001", "duration_s": 60}'

  Check results:
  - http://localhost:3000/reports — 4 stakeholder reports
  - http://localhost:3000/graph — new node in knowledge graph
  - vault/calls/test-001.md — extracted intel
  - vault/_reports/test-001-*.md — report files

  With real Vapi call (needs API keys + ngrok):
  curl -X POST http://localhost:8080/demo/trigger