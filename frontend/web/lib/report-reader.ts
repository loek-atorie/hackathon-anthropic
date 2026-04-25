// Server-side report reader. Fetches stakeholder markdown reports from the
// P2 backend (which owns the vault volume on Fly).
//
// IMPORTANT: do not import this from a client component. It uses server-only
// env (BACKEND_URL).

import "server-only";

const STAKEHOLDERS = ["politie", "bank", "telco", "public"] as const;
type Stakeholder = (typeof STAKEHOLDERS)[number];

export type ReportMap = Record<Stakeholder, string>;

function backendUrl(): string {
  const url = process.env.BACKEND_URL;
  if (!url) {
    throw new Error("BACKEND_URL is not set — point it at the P2 backend (e.g. https://whale-p2.fly.dev)");
  }
  return url.replace(/\/$/, "");
}

export async function loadReports(callId: string): Promise<ReportMap> {
  const res = await fetch(`${backendUrl()}/api/reports/${encodeURIComponent(callId)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    // Mirror the old behaviour: a missing/unreadable report yields empty strings,
    // not a hard error.
    return Object.fromEntries(STAKEHOLDERS.map((s) => [s, ""])) as ReportMap;
  }
  const data = (await res.json()) as Partial<ReportMap>;
  return Object.fromEntries(
    STAKEHOLDERS.map((s) => [s, typeof data[s] === "string" ? (data[s] as string) : ""]),
  ) as ReportMap;
}

export async function listReportCallIds(): Promise<string[]> {
  const res = await fetch(`${backendUrl()}/api/reports`, { cache: "no-store" });
  if (!res.ok) return [];
  const ids = (await res.json()) as unknown;
  return Array.isArray(ids) ? (ids.filter((x) => typeof x === "string") as string[]) : [];
}
