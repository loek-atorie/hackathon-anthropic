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
  fixes:
  --------

   1. No timeout on Claude call
  - Before: if Claude took 30 seconds mid-call, the hint arrived useless
   — scammer had already moved on
  - After: hard 8-second cap. If Claude doesn't respond in time, Mevrouw
   falls back to "Kunt u dat nog eens herhalen?" — always safe to say

  2. No confidence threshold
  - Before: any call where is_scam=True triggered hints, even if Claude
  was only 20% confident
  - After: skips if confidence < 0.7 — same threshold as graph builder,
  consistent across the whole pipeline

  3. Urgency gap fired on every call
  - Before: urgency_score starts at 0 by default, so "why is it urgent"
  was always the first gap — Mevrouw would ask about urgency before the
  scammer had even made his pitch
  - After: removed entirely — urgency is something we measure from the
  scammer's words, not something we need to ask him about

  4. Standalone run failed without PYTHONPATH
  - Before: running python agents/interrogator.py directly crashed with
  ModuleNotFoundError: No module named 'agents'
  - After: added sys.path.insert inside the __main__ block so it works
  with a plain python agents/interrogator.py
  