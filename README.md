# The Scammer's Mirror

**AI honeypot grandmothers that hunt scammers — and a public knowledge graph banks, telcos, and police can subscribe to.**

Built in 24 hours at the Anthropic hackathon. Multi-agent system that answers scam calls in Dutch, keeps the scammer talking, extracts everything (claimed bank, IBAN, callback number, scripts, tactics, voiceprint), and feeds a live intelligence graph that fires real-time alerts to stakeholders.

> *"We built grandmothers that hunt scammers."*

---

## The pitch

EU citizens lost €40–60 billion to scam calls last year. The current defenders — Apate.ai (CommBank, Australia), O2's Daisy (UK), Lenny — are closed, single-vendor, single-country systems. A mule IBAN flagged at one bank in Sydney doesn't help ABN AMRO in Amsterdam.

**Our wedge is the graph, not the bot.** The bots are commodity in 2026 — anyone can vibe-code a Lenny in a weekend. The defensible thing is a transparent, federation-ready intelligence layer that sits above any honeypot system, written as plain markdown so any bank, telco, or researcher can read it without a vendor contract.

The scammers' economics depend on volume. We make their volume worthless.

---

## Demo

Click **"Trigger demo call"** in the dashboard. Our **Scammer Agent** (Claude, role-playing a Dutch ING fraud-team caller) dials our honeypot. **Mevrouw Jansen** (78, Zwolle, slightly hard of hearing) picks up. While they talk, four more agents harvest, structure, link, and report the intelligence — live on screen.

```
                        ┌─────────────────────────────┐
                        │  Scammer Agent (Claude)     │  ← demo trigger
                        │  Outbound Vapi call         │
                        └──────────────┬──────────────┘
                                       │  PSTN
                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Vapi (Dutch DID)                                                │
│  ┌─────────────────────────────────────────┐                     │
│  │ Mevrouw Jansen (Claude Sonnet 4.6)      │                     │
│  │ ElevenLabs voice clone                  │                     │
│  └────────────┬────────────────────────────┘                     │
│               │  live transcript stream                          │
└───────────────┼──────────────────────────────────────────────────┘
                ▼
       ┌────────────────────┐         ┌──────────────────────────┐
       │ The Listener       │ ───►    │ The Interrogator         │
       │ (Reson8 MCP)       │ JSON    │ (Claude)                 │
       │ extracts entities  │         │ identifies gaps,         │
       └────────┬───────────┘         │ feeds nudges back to     │
                │                     │ Mevrouw mid-call         │
                ▼                     └──────────┬───────────────┘
       ┌────────────────────┐                    │
       │ Graph Builder      │                    ▼
       │ (Claude)           │           Vapi function-call:
       │ writes markdown    │           inject next question
       │ to Obsidian vault  │
       └────────┬───────────┘
                ▼
       ┌────────────────────┐
       │ Reporter (Claude)  │  ← fires after call ends
       │ Politie / Bank /   │
       │ Telco / Public     │
       └────────────────────┘
```

The Obsidian vault lights up node by node. Stakeholder reports fire to mocked Politie / ING / KPN inboxes. The public counter ticks up: **scammer minutes wasted today: 4,287**.

---

## The agents

| # | Agent | Stack | Role |
|---|---|---|---|
| 1 | **Mevrouw Jansen** | Vapi + Claude Sonnet 4.6 + ElevenLabs | The honeypot persona. 78, Zwolle, slightly hard of hearing — an in-character justification for asking the scammer to repeat himself, which extends call duration without arousing suspicion. |
| 2 | **The Listener** | Reson8 MCP | Watches the transcript stream. Every ~10 seconds emits structured JSON: claimed bank, IBAN, callback number, urgency tactics, script signature. |
| 3 | **The Interrogator** | Claude Sonnet 4.6 | Reads the latest extraction state, identifies gaps ("we don't have an IBAN yet"), nudges Mevrouw mid-call. The visibly-agentic moment. |
| 4 | **Graph Builder** | Claude Sonnet 4.6 | Turns extracted entities into markdown files with frontmatter and `[[wikilinks]]`. Writes to the Obsidian vault. |
| 5 | **Reporter** | Claude Sonnet 4.6 | After the call ends, generates four stakeholder documents in fluent Dutch: Politie case file, bank fraud-team alert, telco abuse list, public "scam of the week." |
| 6 | **Scammer Agent** | Claude Sonnet 4.6 | The adversary. Outbound Vapi call to Mevrouw on demo trigger. Role-plays a Dutch bank fraud-team scammer. AI vs AI on stage. |

---

## The knowledge graph

Every call becomes a markdown file. Every entity (scammer voice cluster, IBAN, claimed bank, script fingerprint) becomes a markdown file. Relationships are `[[wikilinks]]`.

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
```

Open the `vault/` folder in Obsidian. The graph view *is* our intelligence visualization. No proprietary graph DB, no vendor lock-in. A Dutch journalist or a Politie analyst can clone the repo and read the case files in any text editor.

This is what "EU-sovereign" actually means in practice.

---

## Why open beats closed

| | Closed (Apate / Daisy) | The Scammer's Mirror |
|---|---|---|
| Data ownership | One bank, one country | Federated, GDPR-native |
| Telco integration | SIP-only, BigCorp deals | Citizen-deployable |
| Languages | English variants | Dutch first, EU-multilingual roadmap |
| Researcher access | Proprietary | Public anonymized feed |
| Format | Internal DB | Plain markdown, git-versioned |
| Federation | None | First-class |

---

## Stack

- **Telephony:** [Vapi](https://vapi.ai) — bundled Dutch DID, ~€2/mo + €0.05–0.10/min
- **Voice agent LLM:** Claude Sonnet 4.6
- **TTS:** ElevenLabs custom voice clone (consented sample)
- **Intelligence extraction:** [Reson8](https://reson8.ai) MCP
- **Reasoning + reports:** Anthropic SDK (`claude-sonnet-4-6`)
- **Knowledge graph:** Obsidian markdown vault
- **Backend:** Python / FastAPI, SSE bus
- **Frontend:** Next.js + Tailwind + shadcn/ui (Vercel)

---

## Repo layout

```
hackathon-anthropic/
├── README.md                  ← this file
├── .claude/plan.md            ← 24-hour build plan
├── apps/
│   ├── api/                   ← FastAPI: agents, Vapi webhooks, SSE bus
│   └── web/                   ← Next.js dashboard
├── vault/                     ← Obsidian knowledge graph (markdown)
│   ├── calls/   scammers/   ibans/   scripts/   banks/
├── prompts/                   ← system prompts, one .md per agent
└── demo/                      ← run-book + printable handouts
```

Full hour-by-hour build plan, agent contracts, and verification checklist live in [.claude/plan.md](.claude/plan.md).

---

## Team

24 hours. Three people. Three tracks.

- **P1 — Voice + Adversary** — Vapi, Mevrouw Jansen persona, ElevenLabs clone, Scammer Agent outbound dialer.
- **P2 — Intelligence agents** — Reson8 Listener, Interrogator loop, Graph Builder, Reporter, FastAPI + SSE bus.
- **P3 — Frontend + Obsidian + demo polish** — Next.js dashboard, live transcript view, public counter, stakeholder reports, Obsidian vault setup, printed handouts, demo run-book.

Sync checkpoints: H4 (first call), H8 (transcript flowing), H12 (graph live), H16 (reports firing), H20 (dry-run #1), H23 (freeze).

---

## Roadmap (out of scope for the 24h MVP)

- Real telco SIP federation
- Multilingual EU coverage (24 languages)
- Privacy-preserving voiceprint clustering at scale
- Real-time voice-clone-of-a-relative detection
- Mule-account chain analysis across jurisdictions
- GDPR-compliant consent flow for citizen-deployed honeypots
- Federated graph protocol between banks / telcos / police
- Public dashboard at `scamradar.nl`
- Integration with Fraudehelpdesk, Politie LMIO, Europol, AMLA

---

## One unexpected angle

Most scammers in big call centers are themselves victims of human trafficking — well documented in the scam compounds of Cambodia and Myanmar. Our bots wasting their time isn't punishing them. It's reducing the profit motive for their captors.

That reframes this from a security pitch into a humanitarian one.

---

## Sponsors

Anthropic · Reson8 · Vapi · ElevenLabs

## License

Open source. EU-sovereign by design.
