# Deploying Scammer's Mirror to production

Two Fly.io apps + one Vercel project. About 30 minutes end-to-end the first time.

```
Vapi (inbound calls) ──► Fly: whale-p1 (apps/api/)
                             │
                             │ httpx ──► Fly: whale-p2 (backend/)  ◄── Volume: /data/vault
                             │                  │
                             │                  ▼
                             │              SSE  ──────► Vercel: frontend/web
                             │                  │
                             ◄──────────────────┘   nudges via /internal/nudge
```

- **whale-p1** receives Vapi webhooks at `POST /vapi/webhooks` and forwards transcript chunks to whale-p2 via Fly's internal DNS.
- **whale-p2** runs the Claude agents (listener, graph builder, reporter, interrogator), writes the vault, and exposes the SSE stream the dashboard subscribes to.
- The Vercel frontend reads vault data through whale-p2's `/api/graph`, `/api/vault-node`, and `/api/reports/*` routes — Vercel itself never touches the vault filesystem.

---

## 0. Pre-flight (one-time)

- **Revoke the leaked `ANTHROPIC_API_KEY`.** Commit `a1a25de` put one in git history. Rotate it in console.anthropic.com and use the new key for `fly secrets set`. Never commit again.
- Install the Fly CLI: `brew install flyctl && fly auth login`.
- Make sure you're on `deploy/fly-vercel` branch (or your equivalent).

---

## 1. Deploy P2 (backend) — needs the volume

```bash
cd backend

# Pick an app name — these instructions assume "whale-p2".
fly launch --no-deploy --copy-config --name whale-p2 --region ams

# Allocate the vault volume (3GB is plenty for tens of thousands of calls).
fly volumes create vault_data --size 3 --region ams --yes

# Set secrets (do NOT paste keys in your shell history; use `fly secrets set` interactively if your shell logs).
fly secrets set \
  ANTHROPIC_API_KEY="$(read -rs k && echo $k)" \
  VAPI_API_KEY="$(read -rs k && echo $k)"

# Or non-interactive:
# fly secrets set ANTHROPIC_API_KEY=sk-ant-... VAPI_API_KEY=...

# After P1 exists (Step 2), come back and set:
# fly secrets set P1_WEBHOOK_URL="https://whale-p1.fly.dev/internal/nudge"
# (Use the public fly.dev hostname rather than `whale-p1.internal` — see "Inter-app URLs" note below.)

fly deploy
fly logs   # watch a few seconds — you should see uvicorn boot

# Seed the vault on the volume so the dashboard isn't empty
fly ssh sftp shell <<'EOF'
put -r ../vault /data/vault
EOF
# (or `fly ssh console` and `mkdir -p /data/vault` first if sftp complains)

curl https://whale-p2.fly.dev/health           # {"status":"ok",...}
curl https://whale-p2.fly.dev/api/graph | jq . # should list seeded vault nodes
```

---

## 2. Deploy P1 (Vapi-facing)

```bash
cd ../apps/api

fly launch --no-deploy --copy-config --name whale-p1 --region ams

fly secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  VAPI_API_KEY=... \
  VAPI_ASSISTANT_ID_MEVROUW=... \
  VAPI_ASSISTANT_ID_SCAMMER=... \
  VAPI_PHONE_NUMBER_ID=... \
  MEVROUW_PHONE_NUMBER=... \
  P2_INGEST_URL=https://whale-p2.fly.dev

fly deploy

curl https://whale-p1.fly.dev/healthz   # {"ok":true}
```

Now wire whale-p2 back to whale-p1 for nudges:

```bash
cd ../../backend
fly secrets set P1_WEBHOOK_URL=https://whale-p1.fly.dev/internal/nudge
# triggers a rolling restart on its own
```

**Inter-app URLs — why public `*.fly.dev` and not `*.internal`?**
Fly's 6PN private network (`<app>.internal`) is IPv6-only. The Python images
in this repo run uvicorn with `--host 0.0.0.0` (IPv4 only — Firecracker microVMs
have `bindv6only=1`, so binding to `::` would silently break Fly's IPv4 health
check). Forwarding from one app to another over `<app>.internal` therefore
gets `Connection refused`. The public `https://<app>.fly.dev` URL terminates
TLS at Fly's edge and proxies to the IPv4 listener — same datacenter when
both apps share `primary_region`, negligible latency penalty for fire-and-forget
transcript posts. If you ever need true private inter-app traffic, allocate a
flycast IP (`fly ips allocate-v6 --private`) and disable `force_https` so a
plain `http://<app>.flycast` POST works — for this hackathon stack the public
URL is simpler and good enough.

---

## 3. Point Vapi at P1

In the Vapi dashboard, on the **Mevrouw inbound assistant**:

- **Server URL** → `https://whale-p1.fly.dev/vapi/webhooks`
- **Server URL secret / token** (optional, recommended) — set one and read it inside `apps/api/vapi/webhooks.py` if you want HMAC verification later.

That's it. The Mevrouw phone number doesn't change. Anyone who already has it keeps reaching her.

---

## 4. Deploy the dashboard to Vercel

In Vercel → New Project → import this repo, and set:

- **Root Directory**: `frontend/web`
- **Framework Preset**: Next.js (auto-detected)
- **Install Command**: `pnpm install --frozen-lockfile`
- **Build Command**: `pnpm build`

Environment variables (Project Settings → Environment Variables, all environments):

| Name                              | Value                              |
| --------------------------------- | ---------------------------------- |
| `BACKEND_URL`                     | `https://whale-p2.fly.dev`         |
| `NEXT_PUBLIC_SSE_URL`             | `https://whale-p2.fly.dev/events`  |
| `NEXT_PUBLIC_API_URL`             | _(leave unset in prod)_            |
| `NEXT_PUBLIC_ENABLE_DEMO_TRIGGER` | _(leave unset in prod)_            |

Deploy. Open the Vercel URL → `/`, `/graph`, `/live`. The seeded vault should render.

---

## 5. End-to-end live test

1. Dial the Mevrouw Vapi DID from a real phone.
2. On the Vercel `/live` page, transcript should stream within ~1s of speech.
3. As Mevrouw extracts an IBAN/org/script, those nodes should pop into `/graph`.
4. Hang up. Within ~30s, four stakeholder reports should appear under `/reports/<call-id>`.
5. `fly logs -a whale-p2` should show listener + reporter activity. `/data/vault` should now contain new files (`fly ssh console` → `ls /data/vault/calls/`).

---

## Local dev mirror

```bash
# P2
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
ANTHROPIC_API_KEY=sk-ant-... uvicorn main:app --port 8000

# P1 (separate terminal)
cd apps/api
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
P2_INGEST_URL=http://localhost:8000 \
  ANTHROPIC_API_KEY=sk-ant-... \
  VAPI_API_KEY=... \
  VAPI_ASSISTANT_ID_MEVROUW=... VAPI_ASSISTANT_ID_SCAMMER=... \
  VAPI_PHONE_NUMBER_ID=... MEVROUW_PHONE_NUMBER=... \
  uvicorn main:app --port 8080

# Frontend (separate terminal)
cd frontend/web
BACKEND_URL=http://localhost:8000 \
  NEXT_PUBLIC_SSE_URL=http://localhost:8000/events \
  NEXT_PUBLIC_API_URL=http://localhost:8080 \
  NEXT_PUBLIC_ENABLE_DEMO_TRIGGER=true \
  pnpm dev
```

For Vapi to reach your local P1 in dev, run `ngrok http 8080` and paste the ngrok URL into Vapi's Server URL field temporarily.

---

## What's _not_ yet HA

This deploy runs one machine per Fly app. Good enough for a demo / continuous-but-single-call service. Before you can comfortably scale to multiple machines:

- `apps/api/streaming.py` and `backend/main.py` keep SSE subscribers in a Python list — events published on machine A miss subscribers on machine B. Replace with Redis Pub/Sub (Upstash) when you need it.
- `apps/api/vapi/outbound.py` keeps the in-flight call IDs in module globals — only one demo call at a time. Move to a Redis hash keyed by `call_id` to handle concurrent inbound calls.
- A Fly Volume only attaches to one machine. Multi-machine vault writes mean migrating `backend/agents/graph_builder.py` to S3/R2 (or designating a single writer machine).

None of those are blockers for shipping today.
