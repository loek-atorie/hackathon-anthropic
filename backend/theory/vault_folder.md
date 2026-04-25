Four folders exist. Nothing is written there yet — the Graph
  Builder agent will fill them during calls.

  Why these four folders and not one?
  - Obsidian's graph view groups files by folder — judges immediately
  see "calls", "ibans", "organisations" as distinct node clusters
  - Idempotent upserts are easy: same IBAN = same filename = just
  overwrite/update that one file
  - Police/bank analysts browsing the vault find what they need without
  searching