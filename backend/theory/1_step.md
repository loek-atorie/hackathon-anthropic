 ---
  Test what's already running (correct commands)

  Terminal 2 — watch the SSE stream:
  curl -N http://localhost:8000/events

  Terminal 3 — simulate Vapi posting a transcript:
  curl -X POST http://localhost:8000/publish \
    -H "Content-Type: application/json" \
    -d '{"type": "transcript_chunk", "call_id": "test-001", "text":
  "Goedemiddag ABN AMRO veiligheid"}'

  Health check:
  curl http://localhost:8000/health

  ---
  Test the Claude extraction directly

  cd /home/pskpe/hackathon-anthropic/backend
  .venv/bin/python agents/listener.py

  This runs the canned Dutch ING scam transcript through Claude and
  prints the structured JSON. Expected output:

  {
    "claimed_bank": "ING",
    "iban": "NL91ABNA0417164300",
    "callback_number": "020-1234567",
    "tactics": ["urgency", "authority", "fear", "social_proof",
  "scarcity"],
    "urgency_score": 10,
    "script_signature": "bank-helpdesk"
  }

  ---
  What's missing to connect them

  The listener's process_and_publish() already calls POST /publish
  automatically after extraction. So the remaining glue for Hours 4–6 is
   just wiring /ingest-style endpoint → process_and_publish():

  Add this to main.py:
  from agents.listener import process_and_publish

  @app.post("/ingest")
  async def ingest(payload: dict):
      transcript = payload.get("text", "")
      call_id = payload.get("call_id", "unknown")
      extraction = await process_and_publish(transcript, call_id)
      return extraction.model_dump()

  Then test the full pipeline in one shot:
  curl -X POST http://localhost:8000/ingest \
    -H "Content-Type: application/json" \
    -d '{"call_id": "live-001", "text": "Goedemiddag, u spreekt met ING
  beveiligingsdienst..."}'

  Events appear in curl -N http://localhost:8000/events within ~3
  seconds (Claude call time).
