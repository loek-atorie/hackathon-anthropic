# The Scammer's Mirror — 24h Hackathon Plan

> AI honeypot grandmothers that hunt scammers. Multi-agent system that answers scam calls, extracts intelligence in real time, and feeds a public knowledge graph banks, telcos, and police can subscribe to.

---

## Context

**Why this matters.** Scam losses in the EU run €40–60B/year. Existing defenses (Apate.ai, O2 Daisy, Lenny) are closed, single-vendor, single-country. Our wedge is **a multi-agent extraction pipeline + an open, file-based intelligence graph** — EU-sovereign, transparent, federation-ready. We pitch the graph, not the bot.

**Demo narrative.** A judge dials a Dutch number from their own phone. "Mevrouw Jansen" answers. Or — better — they click a button and our **Scammer Agent** dials Mevrouw Jansen, and judges watch two AIs go at it on stage while four other agents harvest, structure, link, and report the intel. The Obsidian graph lights up in real time. Stakeholder reports fire to mocked Politie/ING/KPN inboxes.

**One-liner for the judges.** "We built grandmothers that hunt scammers — and a knowledge graph that turns every scam call into a case file for the police."

---

## Locked decisions

Area                                  Decision
------------------------------------  ---------------------------------------------------------------------------------
Telephony                             Vapi with bundled Dutch DID. Backup: BE/UK number if NL provisioning stalls.
Honeypot voice loop                   Vapi → Claude Sonnet 4.6 as Mevrouw Jansen. ElevenLabs voice clone (consented, ~30s sample).
Persona                               Mevrouw Jansen, 78, Zwolle. Late husband baker. Daughter in Australia. Slightly hard of hearing (justifies asking scammer to repeat — extends call duration).
Intelligence extractor                Reson8 MCP (sponsor, free credits). Watches transcript stream, emits structured JSON every ~10s.
Report generation                     Anthropic SDK direct, Claude Sonnet 4.6. Generates Politie / Bank / Telco / Public reports.
Knowledge graph                       Obsidian vault of markdown files with frontmatter + wikilinks. Obsidian's built-in graph view IS our graph view. Stretch: in-dashboard force-directed view from same files.
Adversary                             Scammer Agent (Claude) — outbound Vapi call to Mevrouw Jansen on demo trigger. AI vs AI.
Observability                         None.
Languages                             Dutch only.
Federation/SIP/voice-cloning detect.  Hand-waved as roadmap.


---

## Architecture — six agents

```
                        ┌─────────────────────────────┐
                        │  Scammer Agent (Claude)     │  ← demo trigger
                        │  Outbound Vapi call         │
                        └──────────────┬──────────────┘
                                       │  PSTN
                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Vapi (Dutch DID)                                                 │
│  ┌─────────────────────────────────────────┐                     │
│  │ Mevrouw Jansen (Claude Sonnet 4.6)      │  ← system prompt    │
│  │ ElevenLabs voice clone                  │                     │
│  └────────────┬────────────────────────────┘                     │
│               │  live transcript stream (websocket)              │
└───────────────┼──────────────────────────────────────────────────┘
                ▼
       ┌────────────────────┐         ┌──────────────────────────┐
       │ The Listener       │ ───►    │ The Interrogator         │
       │ (Reson8 MCP)       │ JSON    │ (Claude)                 │
       │ extracts entities  │         │ identifies gaps,         │
       └────────┬───────────┘         │ feeds nudges back to     │
                │                     │ Mevrouw Jansen mid-call  │
                │                     └──────────┬───────────────┘
                ▼                                │
       ┌────────────────────┐                    │
       │ Graph Builder      │                    │
       │ (Claude)           │                    │
       │ writes markdown    │                    │
       │ to Obsidian vault  │                    │
       └────────┬───────────┘                    │
                │                                ▼
                │                    Vapi function-call: inject
                │                    next question to Mevrouw
                ▼
       ┌────────────────────┐
       │ Reporter (Claude)  │  ← fires after call ends
       │ Politie / Bank /   │
       │ Telco / Public     │
       └────────────────────┘
                │
                ▼
       Dashboard (Next.js) — live transcript, counter, graph, reports, mock alerts
```

**Inter-agent loop** (the visibly-agentic moment): Listener extracts → Interrogator notices "no IBAN yet" → suggests "naively ask which account to transfer to" → fed back into Mevrouw Jansen via Vapi `assistant.say` or function-call.

---

## Tech stack

- **Telephony:** Vapi (bundled Dutch number, ~€2/mo + €0.05–0.10/min)
- **Voice agent LLM:** Claude Sonnet 4.6 via Vapi config
- **TTS voice:** ElevenLabs custom clone (Vapi-native)
- **Intelligence extractor:** Reson8 MCP (sponsor credits)
- **Report + Interrogator + Graph Builder:** Anthropic SDK (`claude-sonnet-4-6`)
- **Knowledge graph:** Obsidian vault (markdown + frontmatter + `[[wikilinks]]`), watched live
- **Backend:** Python (FastAPI) — single service, one repo
- **Frontend:** Next.js + Tailwind + shadcn/ui, deployed to Vercel
- **Realtime:** Server-Sent Events (SSE) from FastAPI → dashboard
- **Vault sync:** local folder, mounted into Obsidian on demo laptop
- **Hosting:** ngrok for Vapi webhooks during dev; Vercel + Fly.io for the live demo

---

## Repo structure

```
hackathon-anthropic/
├── README.md                  ← demo run-book + one-pager (build this last)
├── .claude/
│   └── plan.md                ← this file
├── apps/
│   ├── api/                   ← FastAPI (P2 owns)
│   │   ├── main.py
│   │   ├── agents/
│   │   │   ├── listener.py        ← Reson8 MCP client
│   │   │   ├── interrogator.py    ← Claude, gap-finder
│   │   │   ├── graph_builder.py   ← Claude → markdown
│   │   │   └── reporter.py        ← Claude → 4 reports
│   │   ├── vapi/
│   │   │   ├── webhooks.py        ← inbound from Vapi
│   │   │   └── outbound.py        ← Scammer Agent dialer
│   │   └── streaming.py           ← SSE bus
│   └── web/                   ← Next.js (P3 owns)
│       ├── app/
│       │   ├── live/page.tsx      ← live transcript + extraction sidebar
│       │   ├── graph/page.tsx     ← embeds Obsidian graph (iframe) + custom view
│       │   ├── reports/page.tsx   ← stakeholder reports
│       │   └── public/page.tsx    ← scammer-minutes-wasted counter
│       └── lib/sse.ts
├── vault/                     ← Obsidian vault (committed, demo-ready)
│   ├── calls/
│   ├── scammers/
│   ├── ibans/
│   ├── scripts/
│   └── banks/
├── prompts/                   ← all system prompts, one .md per agent
│   ├── mevrouw_jansen.md
│   ├── scammer_agent.md
│   ├── listener.md
│   ├── interrogator.md
│   ├── graph_builder.md
│   └── reporter.md
└── demo/
    ├── run.sh                 ← one-command demo trigger
    └── handouts/              ← printable PDFs of mock reports
```

---

## Knowledge-graph schema (Obsidian markdown)

Every entity is a markdown file. Relationships are `[[wikilinks]]` in body or frontmatter list fields.

**`vault/calls/2026-04-25T14-22-call-0042.md`**
```markdown
---
type: call
id: call-0042
started_at: 2026-04-25T14:22:11Z
duration_s: 1840
scammer: "[[scammer-voice-A7]]"
claimed_bank: "[[ING]]"
script: "[[bank-helpdesk-v3]]"
extracted_ibans: ["[[NL12RABO0123456789]]"]
tactics: [urgency, authority, fear]
language: nl
---
# Call 0042 — "ING fraude-team"

## Transcript
...
```

**`vault/ibans/NL12RABO0123456789.md`**
```markdown
---
type: iban
iban: NL12RABO0123456789
bank_prefix: RABO
first_seen: 2026-04-25T14:22:11Z
seen_in_calls: ["[[call-0042]]", "[[call-0039]]"]
status: flagged
---
```

Graph Builder agent emits these files. Obsidian's graph view renders relationships automatically.

---

## Work split — 24h, 3 people

**Hour 0 = kickoff. Hour 24 = demo.**

### Track 1 — Voice + Adversary (P1)
*Owns the entire telephony track. End-to-end demo dependency.*

| Hour | Task |
|---|---|
| 0–1 | Vapi account, provision Dutch number, smoke-test default voice |
| 1–3 | Mevrouw Jansen system prompt v1 (`prompts/mevrouw_jansen.md`); test in Vapi playground |
| 3–5 | Record consented voice sample; clone in ElevenLabs; wire into Vapi |
| 5–8 | Vapi inbound webhook → FastAPI `/vapi/webhooks` (transcript stream) |
| 8–11 | Scammer Agent prompt + outbound Vapi call trigger (`POST /demo/trigger`) |
| 11–14 | Tool/function-call wiring: Mevrouw can receive "next-question hints" from Interrogator mid-call |
| 14–17 | End-to-end test: Scammer ↔ Mevrouw, transcript flows through API |
| 17–20 | Polish persona: hard-of-hearing tactics, naive deflections, time-stretching prompts |
| 20–23 | Dry-run demo with full team. Tune for 4–6 min runtime per call |
| 23–24 | Standby for demo |

### Track 2 — Intelligence agents + graph (P2)
*Owns Reson8 + Claude pipeline + Obsidian vault writer.*

| Hour | Task |
|---|---|
| 0–1 | FastAPI skeleton, SSE bus, repo scaffolding |
| 1–4 | Reson8 MCP client (`agents/listener.py`); test extraction on canned NL scam transcript |
| 4–6 | Listener emits structured JSON: `claimed_bank`, `iban`, `callback_number`, `tactics[]`, `urgency_score`, `script_signature` |
| 6–9 | Graph Builder: JSON → markdown files with frontmatter + `[[wikilinks]]`. Idempotent upserts. |
| 9–12 | Interrogator agent: reads latest extraction state → emits next-question hint → POST to P1's webhook |
| 12–14 | Reporter: end-of-call → 4 markdown reports (Politie, Bank, Telco, Public) using Claude |
| 14–17 | Voiceprint placeholder: hash-based "voice cluster" id from Vapi metadata (mock real ML) |
| 17–20 | Integration with P1's transcript stream; integration with P3's SSE consumers |
| 20–23 | Dry-run + bug-fix |
| 23–24 | Standby |

### Track 3 — Frontend + Obsidian + demo polish (P3)
*Owns what the judges see.*

| Hour | Task |
|---|---|
| 0–1 | Next.js + Tailwind + shadcn scaffold; deploy stub to Vercel |
| 1–4 | `/live` page: transcript stream, timer, extraction sidebar (consumes SSE from P2) |
| 4–6 | `/public` counter: "Scammer minutes wasted today" — animated, big numbers |
| 6–9 | `/reports` page: tabs for Politie / Bank / Telco / Public; renders markdown |
| 9–11 | Mock notification firing: WhatsApp/Slack-styled toast on screen during demo ("ING fraud team alerted: NL12RABO… blocked") |
| 11–13 | Obsidian setup: vault committed to repo, opened on demo laptop, graph view configured |
| 13–16 | `/graph` page: iframe to Obsidian Publish OR custom force-directed view from `vault/*.md` (stretch C) |
| 16–18 | Demo run-book: scripted 60s pitch, button positions, screen layout |
| 18–20 | Print handouts: Politie case file PDF, bank alert mock, telco list, public newsletter |
| 20–23 | Dry-run + visual polish |
| 23–24 | Standby |

### Synchronization checkpoints

- **H4** — "Hello world" call: Mevrouw answers, transcript appears in API logs. P1+P2 sync.
- **H8** — End-to-end transcript: Scammer Agent calls Mevrouw, Listener emits one JSON. All 3 sync.
- **H12** — Graph live: one full call writes ≥3 markdown files; Obsidian graph view shows nodes. All 3 sync.
- **H16** — Reporter fires: end-of-call Politie report renders in `/reports`. All 3 sync.
- **H20** — Full dry-run #1. Identify the top 3 demo risks; spend H20–H23 on those only.
- **H23** — Full dry-run #2. Freeze code.

---

## Demo run-book (60 seconds)

> **[H1, P3 on screen]** "This is Mevrouw Jansen — 78, Zwolle. Her number is one of 50 honeypots we operate."
>
> **[H2, P1 clicks 'Trigger demo call']** Scammer Agent dials. Live transcript appears.
>
> **[H3]** Mevrouw asks "wat zegt u, jongen?" — scammer repeats his ING fraud-team script.
>
> **[H4, dashboard sidebar populates]** Listener extracts: claimed bank=ING, IBAN=NL12RABO…, urgency=HIGH.
>
> **[H5]** Interrogator nudges Mevrouw → she "almost gives" the IBAN, asks scammer to confirm — extracts it twice for verification.
>
> **[H6, big toast]** "🚨 ING fraud-team: NL12RABO0123456789 flagged 4 seconds ago." Mock WhatsApp notification on phone visible to judges.
>
> **[H7]** "While they kept talking, this graph just grew" — Obsidian graph view, P3 switches windows.
>
> **[H8]** Counter: "Scammer minutes wasted today: 4,287." Hand judges the printed Politie case file.
>
> **[H9]** "Apate sells this to one bank. Daisy is O2 marketing. Ours is open, EU-sovereign, federation-ready, and Mevrouw Jansen runs on a Raspberry Pi if she has to."

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Vapi NL DID provisioning stalls | Use BE or UK number; demo still dials from a phone |
| Reson8 MCP unfamiliar / unstable | P2 starts with canned transcript at H1 to derisk; fallback = Claude does extraction |
| Inter-agent loop (Interrogator → Mevrouw) flaky | Demo works without it; loop is "stretch wow" — disable if it destabilizes call |
| Obsidian graph view unimpressive when sparse | Pre-seed vault with 30 fake-but-realistic prior calls; every demo run adds to a populated graph |
| Live call latency too high | Test at H4; if >1.5s, drop to Claude Haiku 4.5 for Mevrouw |
| Demo Wi-Fi flakes | Pre-record a backup video at H22 |
| Scammer Agent goes off-script | Tight system prompt + 3 turns max before "main ask"; manual abort button |
| Voice clone consent | Use a teammate's voice or licensed elderly Dutch sample. **No deepfake of a non-consenting person.** |
| Cost overrun | Hard-cap Vapi at €30; Anthropic at €30; Reson8 covered by sponsor credits |

---

## Out of scope (explicit)

- Real telco SIP federation
- Multi-language (NL only)
- Voiceprint biometrics (mocked)
- Voice-cloning detection
- GDPR-compliant consent flow for real elderly users
- Federation layer between banks
- Mule-account chain analysis across jurisdictions

All of these go in the README's "Roadmap" section as the EU-sovereign vision.

---

## Verification (how we know it works at H24)

1. **Phone test:** Dial the Vapi number from any phone. Mevrouw answers in Dutch. Conversation flows for ≥2 minutes.
2. **Trigger test:** Click `/demo/trigger`. Scammer Agent dials Mevrouw. Both AIs converse. Full transcript appears in `/live`.
3. **Extraction test:** During the call, `/live` sidebar populates with claimed_bank + IBAN within 30s of those entities being mentioned.
4. **Graph test:** Open Obsidian on demo laptop. After a call, ≥3 new markdown files exist in `vault/`. Graph view shows new nodes/edges connected to existing ones.
5. **Report test:** After call ends, `/reports` shows 4 generated documents in fluent Dutch within 30s.
6. **Notification test:** Mock bank alert toast appears on screen at the moment the IBAN is extracted.
7. **Counter test:** Public counter increments by call duration in seconds × honeypot count.
8. **Dry-run test:** Full 60-second demo runs end-to-end twice without manual intervention.

---

## What lands in the root README at the end

The root `README.md` (built by P3 at H18–20) contains:
1. The one-liner + 3-paragraph pitch
2. Live demo URL + how to dial Mevrouw Jansen
3. Architecture diagram (the one above)
4. The "5 agents + 1 adversary" table
5. Roadmap (everything from "Out of scope")
6. Sponsors: Anthropic, Reson8, Vapi, ElevenLabs
7. Team P1/P2/P3 + their tracks
8. License: open-source EU-sovereign framing
