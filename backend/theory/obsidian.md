
  The Graph Builder takes the extracted JSON and writes it as markdown
  files into a folder called the Obsidian vault. Each entity gets its
  own file:

  Four types of files it creates:

  vault/
  ├── calls/           ← call-0042.md  (one per call)
  ├── ibans/           ← NL91ABNA0417164300.md  (one per IBAN, updated
  across calls)
  ├── organisations/   ← ING.md  (one per org)
  └── scripts/         ← bank-helpdesk.md  (one per scam pattern)

  Files are linked with [[wikilinks]] — Obsidian reads these and draws a
   visual graph. When the judges open Obsidian during the demo, they see
   nodes lighting up in real-time as calls happen.

  Why markdown and not a database?
  - No setup, no server, no schema migrations
  - Human-readable — a Politie analyst can open the folder in any text
  editor
  - Git-versionable — the whole intelligence history is git log
  - Obsidian's graph view is free and looks impressive

  Risks to know upfront:
  - Two calls finishing at the same time can corrupt the same IBAN file
  (concurrent write problem) — we'll handle this
  - No querying — you can't ask "show all IBANs with urgency > 8"
  without reading every file
  - Obsidian slows down past ~10,000 files — not a problem for a 24h
  hackathon

  ---
  Ready for Step 1 — creating the vault folder structure?

※ recap: Building a scam call analysis pipeline. The extraction agent is
   done and tested. Next step is creating the Obsidian vault folder
  structure for the Graph Builder.
