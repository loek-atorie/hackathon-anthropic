#!/usr/bin/env bash
# test-integration.sh — simulate a full scam call end-to-end without Vapi
#
# What this does:
#   1. Sends transcript chunks to P1's /vapi/webhooks (same shape Vapi sends)
#   2. P1 normalises them to BusEvent format and forwards to P2 /ingest
#   3. P2 runs Claude extraction, writes vault files, emits graph_node_added
#   4. Sends end-of-call-report so P1 emits call_ended → P2 /call_ended
#   5. P2 publishes call_ended to its SSE, which the frontend picks up
#
# Prerequisites:
#   - P1 running: cd apps/api && uvicorn main:app --port 8080
#   - P2 running: cd backend  && uvicorn main:app --port 8000
#   - P1 .env has:  P2_INGEST_URL=http://localhost:8000
#   - P2 .env has:  ANTHROPIC_API_KEY=<real key>
#
# Usage:
#   bash scripts/test-integration.sh [call-id]
#
# Then open http://localhost:3000/graph and http://localhost:3000/reports

set -e

P1="http://localhost:8080"
CALL_ID="${1:-test-$(date +%Y%m%d%H%M%S)}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Simulating scam call: $CALL_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

send_transcript() {
  local role="$1"
  local text="$2"
  curl -s -X POST "$P1/vapi/webhooks" \
    -H "Content-Type: application/json" \
    -d "{
      \"message\": {
        \"type\": \"transcript\",
        \"role\": \"$role\",
        \"transcript\": \"$text\",
        \"transcriptType\": \"final\",
        \"call\": {\"id\": \"$CALL_ID\"}
      }
    }" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ok' if d.get('ok') else '  ERROR: '+str(d))"
}

echo ""
echo "▶ Sending transcript chunks..."
send_transcript "assistant" "Goedemiddag, u spreekt met Mevrouw Jansen."
sleep 0.3
send_transcript "user"      "Goedemiddag, ik bel namens de beveiligingsdienst van ING Bank. Mijn naam is meneer De Vries."
sleep 0.3
send_transcript "assistant" "Wat kan ik voor u doen, meneer De Vries?"
sleep 0.3
send_transcript "user"      "Mevrouw, we hebben verdachte transacties op uw rekening gedetecteerd. U moet nu direct uw geld overmaken naar rekeningnummer NL91ABNA0417164300 om het veilig te stellen."
sleep 0.3
send_transcript "assistant" "Oh nee, dat klinkt ernstig. Hoe weet ik dat u echt van ING bent?"
sleep 0.3
send_transcript "user"      "U kunt ons terugbellen op 020-1234567. Maar elke minuut dat u wacht is gevaarlijk. Code rood! Dit is de hoogste urgentie. Maak alles over wat u heeft."

echo ""
echo "▶ Sending end-of-call-report (triggers reports + graph nodes)..."
curl -s -X POST "$P1/vapi/webhooks" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": {
      \"type\": \"end-of-call-report\",
      \"durationSeconds\": 45,
      \"call\": {\"id\": \"$CALL_ID\"}
    }
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ok' if d.get('ok') else '  ERROR: '+str(d))"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Done. Claude extraction is running in background."
echo ""
echo " Wait ~5–10s for Claude to finish, then:"
echo "   http://localhost:3000/graph    — new call node should appear"
echo "   http://localhost:3000/reports  — 4 stakeholder reports for $CALL_ID"
echo ""
echo " Vault files written to:"
echo "   vault/calls/$CALL_ID.md"
echo "   vault/_reports/$CALL_ID-politie.md"
echo "   vault/_reports/$CALL_ID-bank.md"
echo "   vault/_reports/$CALL_ID-public.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
