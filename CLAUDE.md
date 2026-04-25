# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Scammer's Mirror** — an AI honeypot system that catches phone scammers. A Claude-powered voice (Mevrouw Jansen) answers scam calls, extracts intelligence in real-time, and structures findings as Obsidian markdown for distribution to banks, telcos, and police via an open knowledge graph.

## Development Commands

All frontend commands run from `frontend/web/`:

```bash
cd frontend/web
pnpm install       # install dependencies
pnpm dev           # start dev server (http://localhost:3000)
pnpm build         # production build
pnpm lint          # ESLint 9 + Next.js rules
```

Alternatively, `scripts/start-web.sh` runs the dev server on PORT=6001.

There are no tests configured (hackathon MVP).

## Architecture Overview

The project is conceptually split into three parallel tracks:

- **P1** — Voice + adversary: Vapi phone integration, Mevrouw Jansen voice clone (ElevenLabs), outbound Scammer Agent
- **P2** — Intelligence pipeline: FastAPI + SSE bus, Reson8 MCP entity extraction, Claude agents, vault writer
- **P3** — Frontend (`frontend/web/`): Next.js 16 App Router, all pages, mock-first architecture

This repo contains **P3 only**. The backend (P2) is a separate FastAPI service.

## Frontend Architecture (`frontend/web/`)

### Routes
- `/` — Landing page with demo stats
- `/live` — Real-time transcript stream + extraction sidebar during a call
- `/graph` — Force-directed knowledge graph from vault markdown
- `/reports` — Stakeholder report tabs (Politie / Bank / Telco / Public)
- `/public` — Animated "scammer minutes wasted today" counter

### Data Flow

**Event streaming:** `useBus()` hook (`lib/sse.ts`) subscribes to an SSE endpoint. In development, `lib/mock-bus.ts` replays fixture events on a timeline. Swapping real SSE in requires no component changes — drop in the real endpoint URL.

**Vault as database:** `lib/vault-reader.ts` (server-only) walks `vault/*.md` files, parses YAML frontmatter with `gray-matter`, and builds graph node/edge data at server render time. No SQL/NoSQL — plain markdown.

**`lib/types.ts`** is the frontend-backend contract. It defines:
- `BusEvent` union: `TranscriptDelta | ExtractionUpdate | CallEnded | GraphNodeAdded`
- `VaultEntity` unions: `Call | Scammer | IBAN | Bank | Script` (with frontmatter shapes)

Any backend integration must emit `BusEvent` JSON matching these types.

### Key Files

| File | Purpose |
|------|---------|
| `lib/types.ts` | Frontend-backend contract types |
| `lib/mock-bus.ts` | Fixture event replayer (dev stand-in for SSE) |
| `lib/vault-reader.ts` | Server-only markdown→graph builder |
| `components/force-graph.tsx` | react-force-graph-2d wrapper + color logic |
| `components/extraction-sidebar.tsx` | Live extraction display |
| `components/transcript-stream.tsx` | Dialogue display with speaker colors |
| `app/globals.css` | Design tokens, dark theme, custom `--accent` color |
| `fixtures/*.json` | Transcript + extraction fixture data for demo |

### Design System

- Tailwind CSS v4 + shadcn/ui components
- Custom dark theme with lime-amber hybrid accent (`--accent` in `globals.css`)
- `app/globals.css` is the single source of truth for all custom CSS variables

## Knowledge Graph (Vault)

`vault/` is the live knowledge graph — a flat folder of Obsidian-style markdown files:

- `vault/calls/` — Call records (10 pre-seeded: call-0031 through call-0040)
- `vault/scammers/`, `vault/ibans/`, `vault/banks/`, `vault/scripts/` — Entity folders
- `vault/_reports/` — 40 pre-seeded stakeholder reports (4 types × 10 calls)

Each file has YAML frontmatter + body. Edges in the knowledge graph are inferred from `[[wikilinks]]`. The graph is git-versioned and EU-sovereign by design.

## Backend Integration Points

The frontend is ready to connect to P2's backend. Required:

1. **SSE stream** at `/api/events` emitting `BusEvent` JSON
2. **Vault writes** — backend writes markdown to `vault/` after each call
3. **Report endpoint** — `app/api/reports/[callId]/route.ts` is a stub awaiting implementation
4. **Demo trigger** — POST to `/demo/trigger` starts an outbound Scammer Agent call

## Tech Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **TypeScript 5** (strict mode, path alias `@/*`)
- **Tailwind CSS v4** + shadcn/ui + Base UI
- **gray-matter** — YAML frontmatter parsing
- **react-force-graph-2d** — knowledge graph visualization
- **framer-motion** — animations
- **sonner** — toast notifications
- **react-markdown + remark-gfm** — stakeholder report rendering
