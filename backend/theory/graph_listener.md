
● Pros:

  - Atomic writes (os.replace) — two calls finishing at the same time
  won't corrupt a file
  - _safe() prevents path traversal — a scammer sending
  ../../../etc/passwd as an IBAN can't escape the vault
  - Idempotent upserts — same IBAN seen in 10 calls = one file, not 10
  - Skips "none" and "other" scripts — keeps the graph clean
  - VAULT_ROOT from env var — easy to point at a different folder
  without changing code

  ---
  fixed: 
  =================
   Remaining known limitations (not fixing now — not worth the time for a
   hackathon):
┌───────────────────────────┬─────────────────┬──────────────────┐
  │           Issue           │      Risk       │     Fix now?     │
  ├───────────────────────────┼─────────────────┼──────────────────┤
  │ Org names with            │ Low — Dutch org │ No — needs full  │
  │ colons/quotes break YAML  │  names are      │ PyYAML rewrite   │
  │ frontmatter               │ clean           │                  │
  ├───────────────────────────┼─────────────────┼──────────────────┤
  │ seen_in_calls grows       │ None for 24h    │ No — not a real  │
  │ unbounded over thousands  │ demo            │ problem today    │
  │ of calls                  │                 │                  │
  ├───────────────────────────┼─────────────────┼──────────────────┤
  │ Same call_id passed twice │ Low — Vapi      │ No — add         │
  │  silently overwrites the  │ always gives    │ assertion only   │
  │ call file                 │ unique IDs      │ if it happens    │
  ├───────────────────────────┼─────────────────┼──────────────────┤
  │ .lock files left on disk  │ Cosmetic —      │                  │
  │ after writes              │ Obsidian        │ No               │
  │                           │ ignores them    │                  │
  └───────────────────────────┴─────────────────┴──────────────────┘
