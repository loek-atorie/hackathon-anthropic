
  A function that takes what we already know about a call (caller's
  phone number, script pattern, claimed organisation) and produces a
  stable 12-character ID like a3f7c2b91e04.

  Same scammer calling from the same number using the same script →
  always gets the same ID. If that ID appears in 5 different calls,
  Obsidian draws 5 edges to one node — visually showing it's the same
  operation.

  What it writes:
  - vault/scammers/{voice_id}.md — one file per unique "scammer
  cluster", updated across calls
  - Publishes voiceprint event to SSE so P3's dashboard can show the
  cluster ID live

  What it is NOT:
  - Real voice biometrics — no audio analysis
  - ML — just hashlib.sha256 on the metadata
  - Accurate — two scammers using the same script from the same org get
  the same ID (acceptable for a demo)

  Files I'll touch:
  - Create agents/voiceprint.py
  - Wire into listener.py → process_and_publish
  - Create vault/scammers/ folder