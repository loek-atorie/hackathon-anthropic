You own the intelligence pipeline: receive transcript → extract entities → write the Obsidian graph → generate reports. The judges see your work every time the sidebar populates, a graph node appears, or a report renders. You also feed P3's SSE consumers.

### Track 2 — Intelligence agents + graph (P2)
*Owns Reson8 + Claude pipeline + Obsidian vault writer.*

| Hour | Task |
|---|---|
| 0-1 | FastAPI skeleton, SSE bus, repo scaffolding |
| 1-4 | Reson8 MCP client (`agents/listener.py`); test extraction on canned NL scam transcript |
| 4-6 | Listener emits structured JSON: `claimed_bank`, `iban`, `callback_number`, `tactics[]`, `urgency_score`, `script_signature` |
| 6-9 | Graph Builder: JSON → markdown files with frontmatter + `[[wikilinks]]`. Idempotent upserts. |
| 9-12 | Interrogator agent: reads latest extraction state → emits next-question hint → POST to P1's webhook |
| 12-14 | Reporter: end-of-call → 4 markdown reports (Politie, Bank, Telco, Public) using Claude |
| 14-17 | Voiceprint placeholder: hash-based "voice cluster" id from Vapi metadata (mock real ML) |
| 17-20 | Integration with P1's transcript stream; integration with P3's SSE consumers |
| 20-23 | Dry-run + bug-fix |
| 23-24 | Standby |
======================================
 A system that listens to scam phone calls in
  real-time, figures out what the scammer is doing, and automatically  reports it.
  ===========================================