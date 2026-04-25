// Thin proxy to the P2 backend's /api/vault-node. The vault lives on Fly's
// volume, not Vercel's filesystem, so we forward the request.
import { NextRequest, NextResponse } from "next/server";

function backendUrl(): string {
  const url = process.env.BACKEND_URL;
  if (!url) {
    throw new Error("BACKEND_URL is not set — point it at the P2 backend (e.g. https://whale-p2.fly.dev)");
  }
  return url.replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const path = searchParams.get("path");
  const knownIds = searchParams.get("knownIds") ?? "";

  if (!path) {
    return NextResponse.json({ error: "missing path param" }, { status: 400 });
  }

  const upstream = new URL(`${backendUrl()}/api/vault-node`);
  upstream.searchParams.set("path", path);
  if (knownIds) upstream.searchParams.set("knownIds", knownIds);

  const res = await fetch(upstream, { cache: "no-store" });
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
