#!/usr/bin/env python3
"""Point Mevrouw + Scammer at a public webhook URL (or clear it).

Usage:
    # Once you have a public tunnel URL pointing at the FastAPI app:
    python scripts/set_server_url.py https://abc-123.trycloudflare.com

    # To stop sending webhooks (e.g. tunnel is offline):
    python scripts/set_server_url.py --unset

Tunnels (pick one):
    cloudflared tunnel --url http://localhost:8080      # brew install cloudflared, no auth
    npx localtunnel --port 8080                          # no install, free
    ngrok http 8080                                      # needs ngrok auth

Sets `server.url = <url>/vapi/webhooks` on both assistants so transcript
events from both call legs (inbound Mevrouw + outbound Scammer) reach
the FastAPI app.
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# Lazy-load .env from apps/api/.env if present
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k, v)


def vapi(method: str, path: str, body=None) -> dict:
    api_key = os.environ.get("VAPI_API_KEY")
    if not api_key:
        sys.exit("VAPI_API_KEY not set (export it or place in apps/api/.env)")
    cmd = [
        "curl", "-sS", "-X", method, f"https://api.vapi.ai{path}",
        "-H", f"Authorization: Bearer {api_key}",
        "-H", "Content-Type: application/json",
    ]
    if body is not None:
        cmd += ["--data-binary", json.dumps(body)]
    out = subprocess.check_output(cmd)
    return json.loads(out) if out else {}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("url", nargs="?", help="Public base URL of the FastAPI app (no trailing /vapi/webhooks)")
    g.add_argument("--unset", action="store_true", help="Clear server.url on both assistants")
    args = ap.parse_args()

    targets = {
        "Mevrouw": os.environ.get("VAPI_ASSISTANT_ID_MEVROUW"),
        "Scammer": os.environ.get("VAPI_ASSISTANT_ID_SCAMMER"),
    }
    missing = [k for k, v in targets.items() if not v]
    if missing:
        sys.exit(f"Missing assistant ids in env: {missing}")

    if args.unset:
        body = {"server": None}
        action = "cleared"
    else:
        full = args.url.rstrip("/") + "/vapi/webhooks"
        body = {"server": {"url": full}}
        action = f"-> {full}"

    for name, aid in targets.items():
        out = vapi("PATCH", f"/assistant/{aid}", body)
        srv = out.get("server") or {}
        print(f"{name:8} ({aid[:8]}…)  server.url = {srv.get('url') or '(unset)'}  [{action}]")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
