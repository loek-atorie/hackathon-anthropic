"use client";

import Link from "next/link";
import { useState } from "react";
import type { GraphData, GraphNode } from "@/lib/vault-reader";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  vault: GraphData;
  callIds: string[];
}

type ClientFilter = "alle" | "politie" | "bank" | "telco" | "publiek";
type TopicFilter =
  | "alle"
  | "bank-spoofing"
  | "voice-cloning"
  | "koerier-fraude"
  | "nummer-spoofing";

// ─── Chart data ───────────────────────────────────────────────────────────────
// Mock weekly timeline for the area chart (12 weeks).

const CHART_WEEKS = [
  "w14", "w15", "w16", "w17", "w18", "w19",
  "w20", "w21", "w22", "w23", "w24", "w25",
];

const CHART_DATA: Record<TopicFilter, number[]> = {
  "alle":           [0, 1, 1, 2, 3, 4, 5, 7,  8,  10, 11, 12],
  "bank-spoofing":  [0, 0, 1, 1, 2, 2, 3, 4,  5,  6,  7,  8 ],
  "voice-cloning":  [0, 0, 0, 1, 1, 1, 2, 2,  2,  2,  2,  2 ],
  "koerier-fraude": [0, 0, 0, 0, 1, 1, 1, 1,  2,  2,  2,  2 ],
  "nummer-spoofing":[0, 0, 0, 1, 1, 1, 1, 1,  1,  2,  2,  2 ],
};

const TOPIC_LABELS: Record<TopicFilter, string> = {
  "alle": "Alle",
  "bank-spoofing": "Bank spoofing",
  "voice-cloning": "Voice cloning",
  "koerier-fraude": "Koerier-fraude",
  "nummer-spoofing": "Nummer spoofing",
};

// ─── Helper: derive stats from vault ─────────────────────────────────────────

function deriveStats(vault: GraphData) {
  const calls = vault.nodes.filter((n) => n.type === "call");
  const scammers = vault.nodes.filter((n) => n.type === "scammer");
  const locationCount = vault.nodes.filter((n) => n.type === "location").length;

  // Unique spoofed banks (claimed_bank references)
  const spoofedBanks = new Set<string>();
  for (const call of calls) {
    const bank = call.frontmatter.claimed_bank;
    if (typeof bank === "string") spoofedBanks.add(bank);
  }

  return {
    gesprekken: calls.length,
    daders: scammers.length,
    locationCount,
    spoofedBanks: spoofedBanks.size,
  };
}

function deriveTactieken(calls: GraphNode[]): Array<{ label: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const call of calls) {
    const tactics = call.frontmatter.tactics;
    if (Array.isArray(tactics)) {
      for (const t of tactics) {
        if (typeof t === "string") counts[t] = (counts[t] ?? 0) + 1;
      }
    }
  }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── SVG Area Chart ───────────────────────────────────────────────────────────

function AreaChart({ topic }: { topic: TopicFilter }) {
  const data = CHART_DATA[topic];
  const max = Math.max(...data, 1);
  const W = 600;
  const H = 200;
  const pad = { top: 12, right: 8, bottom: 24, left: 32 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const n = data.length;

  const xOf = (i: number) => pad.left + (i / (n - 1)) * chartW;
  const yOf = (v: number) => pad.top + chartH - (v / max) * chartH;

  // Build a smooth cubic-bezier path through all data points.
  const smoothD = data.reduce((acc, v, i) => {
    if (i === 0) return `M${xOf(0)},${yOf(v)}`;
    const cpX = (xOf(i) + xOf(i - 1)) / 2;
    return `${acc} C${cpX},${yOf(data[i - 1])} ${cpX},${yOf(v)} ${xOf(i)},${yOf(v)}`;
  }, "");
  const area = `${smoothD} L${xOf(n - 1)},${pad.top + chartH} L${xOf(0)},${pad.top + chartH} Z`;

  // Y-axis labels
  const yLabels = [0, Math.round(max / 2), max];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 200 }}
      aria-hidden
    >
      {/* Grid lines */}
      {yLabels.map((v) => (
        <g key={v}>
          <line
            x1={pad.left}
            y1={yOf(v)}
            x2={W - pad.right}
            y2={yOf(v)}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text
            x={pad.left - 4}
            y={yOf(v) + 4}
            textAnchor="end"
            fontSize={9}
            fill="var(--muted-2, #6b7280)"
          >
            {v}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {CHART_WEEKS.map((w, i) =>
        i % 3 === 0 ? (
          <text
            key={w}
            x={xOf(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize={9}
            fill="var(--muted-2, #6b7280)"
          >
            {w}
          </text>
        ) : null,
      )}

      {/* Filled area */}
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaGrad)" />

      {/* Line */}
      <path
        d={smoothD}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots */}
      {data.map((v, i) => (
        <circle
          key={i}
          cx={xOf(i)}
          cy={yOf(v)}
          r={2.5}
          fill="var(--accent)"
        />
      ))}
    </svg>
  );
}

// ─── Client filter bar ────────────────────────────────────────────────────────

const CLIENT_FILTERS: Array<{ key: ClientFilter; label: string }> = [
  { key: "alle", label: "Alle" },
  { key: "politie", label: "Politie" },
  { key: "bank", label: "Bank" },
  { key: "telco", label: "Telco" },
  { key: "publiek", label: "Publiek" },
];

function ClientFilterBar({
  active,
  onSelect,
}: {
  active: ClientFilter;
  onSelect: (f: ClientFilter) => void;
}) {
  return (
    <div className="border-b border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto flex h-10 w-full max-w-[1400px] items-center gap-1 px-6">
        {CLIENT_FILTERS.map(({ key, label }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={[
                "relative flex items-center gap-1.5 px-3 py-1 text-xs transition-colors",
                isActive
                  ? "text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              {label}
              {isActive && (
                <span className="absolute inset-x-3 -bottom-[1px] h-px bg-[var(--accent)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: number | string;
  delta?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-5 py-4">
      <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </span>
      <span className="text-3xl font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
        {value}
      </span>
      {delta && (
        <span className="text-xs text-[var(--muted)]">{delta}</span>
      )}
    </div>
  );
}

// ─── Tactieken bar chart ──────────────────────────────────────────────────────

function TactiekenCard({ calls }: { calls: GraphNode[] }) {
  const tactieken = deriveTactieken(calls).slice(0, 6);
  const max = tactieken[0]?.count ?? 1;
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-5 py-4">
      <h3 className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
        Tactieken
      </h3>
      <div className="flex flex-col gap-2.5">
        {tactieken.map(({ label, count }) => (
          <div key={label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs capitalize text-[var(--foreground)]">
                {label}
              </span>
              <span className="text-xs tabular-nums text-[var(--muted)]">
                {count}×
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[var(--background-elev)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${(count / max) * 100}%`, opacity: 0.75 }}
              />
            </div>
          </div>
        ))}
        {tactieken.length === 0 && (
          <span className="text-xs text-[var(--muted)]">Geen tactieken gevonden</span>
        )}
      </div>
    </div>
  );
}

// ─── Steden kaart card ────────────────────────────────────────────────────────

function StadenKaartCard({ locations }: { locations: GraphNode[] }) {
  const sorted = [...locations].sort(
    (a, b) =>
      (Array.isArray(b.frontmatter.seen_in_calls)
        ? b.frontmatter.seen_in_calls.length
        : 0) -
      (Array.isArray(a.frontmatter.seen_in_calls)
        ? a.frontmatter.seen_in_calls.length
        : 0)
  );
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-5 py-4">
      <h3 className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
        Operatielocaties
      </h3>
      <div className="flex flex-col gap-2">
        {sorted.map((n) => {
          const city =
            typeof n.frontmatter.city === "string" ? n.frontmatter.city : n.id;
          const code =
            typeof n.frontmatter.country_code === "string"
              ? n.frontmatter.country_code
              : "";
          const count = Array.isArray(n.frontmatter.seen_in_calls)
            ? n.frontmatter.seen_in_calls.length
            : 0;
          return (
            <div key={n.id} className="flex items-center justify-between">
              <span className="text-sm text-[var(--foreground)]">
                {city}{code ? `, ${code}` : ""}
              </span>
              <span className="text-xs tabular-nums text-[var(--muted)]">
                {count} {count === 1 ? "gesprek" : "gesprekken"}
              </span>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <span className="text-xs text-[var(--muted)]">Geen locaties gevonden</span>
        )}
      </div>
    </div>
  );
}

// ─── Gespoofde nummers card ───────────────────────────────────────────────────

function GespoofdeNummersCard({ calls }: { calls: GraphNode[] }) {
  const bankCounts: Record<string, number> = {};
  for (const call of calls) {
    const bank = call.frontmatter.claimed_bank;
    if (typeof bank === "string") {
      // Strip wikilink markup: [[ING]] → ING
      const clean = bank.replace(/\[\[|\]\]/g, "");
      bankCounts[clean] = (bankCounts[clean] ?? 0) + 1;
    }
  }
  const entries = Object.entries(bankCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-5 py-4">
      <h3 className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
        Geïmiteerde banken
      </h3>
      <div className="flex flex-col gap-2">
        {entries.map(([bank, count]) => (
          <div key={bank} className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--foreground)]">{bank}</span>
            <span className="text-xs tabular-nums text-[var(--muted)]">
              {count}×
            </span>
          </div>
        ))}
        {entries.length === 0 && (
          <span className="text-xs text-[var(--muted)]">Geen data</span>
        )}
      </div>
    </div>
  );
}

// ─── Gesprekken preview card ──────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function toIso(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function GesprekkenPreviewCard({ calls }: { calls: GraphNode[] }) {
  const sorted = [...calls].sort((a, b) => {
    const aDate = toIso(a.frontmatter.started_at);
    const bDate = toIso(b.frontmatter.started_at);
    return bDate.localeCompare(aDate);
  });
  const preview = sorted.slice(0, 5);
  return (
    <div className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--background-card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
          Gesprekken
        </h3>
        <Link
          href="/reports/calls"
          className="text-xs text-[var(--accent)] hover:underline"
        >
          Open gesprekken →
        </Link>
      </div>
      <div className="flex flex-col divide-y divide-[var(--border)]">
        {preview.map((call) => {
          const id =
            typeof call.frontmatter.id === "string"
              ? call.frontmatter.id
              : call.id;
          const startedAt = toIso(call.frontmatter.started_at);
          const bank =
            typeof call.frontmatter.claimed_bank === "string"
              ? call.frontmatter.claimed_bank.replace(/\[\[|\]\]/g, "")
              : "—";
          const duration =
            typeof call.frontmatter.duration_s === "number"
              ? `${Math.floor(call.frontmatter.duration_s / 60)}m ${call.frontmatter.duration_s % 60}s`
              : "—";
          const tactics = Array.isArray(call.frontmatter.tactics)
            ? (call.frontmatter.tactics as string[]).slice(0, 2)
            : [];
          return (
            <div key={id} className="flex items-center gap-4 px-5 py-3">
              <span className="w-20 shrink-0 font-mono text-[11px] text-[var(--muted)]">
                {id}
              </span>
              <div className="flex w-24 shrink-0 flex-col gap-0.5">
                {startedAt ? (
                  <>
                    <span className="text-[11px] text-[var(--foreground)]">{fmtDate(startedAt)}</span>
                    <span className="text-[10px] tabular-nums text-[var(--muted)]">{fmtTime(startedAt)}</span>
                  </>
                ) : (
                  <span className="text-[11px] text-[var(--muted)]">—</span>
                )}
              </div>
              <div className="flex flex-1 flex-wrap gap-1">
                {tactics.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-[var(--background-elev)] px-1.5 py-0.5 text-[10px] capitalize text-[var(--muted)]"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <span className="shrink-0 text-xs text-[var(--muted)]">{bank}</span>
              <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                {duration}
              </span>
            </div>
          );
        })}
        {preview.length === 0 && (
          <div className="px-5 py-4 text-xs text-[var(--muted)]">
            Geen gesprekken gevonden
          </div>
        )}
      </div>
      <div className="border-t border-[var(--border)] px-5 py-3">
        <Link
          href="/reports/calls"
          className="text-xs font-medium text-[var(--accent)] hover:underline"
        >
          Alle {calls.length} gesprekken bekijken →
        </Link>
      </div>
    </div>
  );
}

// ─── Main dashboard component ─────────────────────────────────────────────────

export function DashboardView({ vault }: Props) {
  const [clientFilter, setClientFilter] = useState<ClientFilter>("alle");
  const [topicFilter, setTopicFilter] = useState<TopicFilter>("alle");

  const calls = vault.nodes.filter((n) => n.type === "call");
  const locations = vault.nodes.filter((n) => n.type === "location");
  const stats = deriveStats(vault);

  return (
    <div className="flex flex-col">
      <ClientFilterBar
        active={clientFilter}
        onSelect={setClientFilter}
      />

      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-6 py-10">
        {/* Page header */}
        <header className="flex flex-col gap-3 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
              Intelligence
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              Reports
            </h1>
            <p className="max-w-2xl text-sm text-[var(--muted)]">
              Realtime inzichten uit onderschepte scam-gesprekken — voor politie, banken en telco&apos;s.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-[var(--border)] bg-[var(--background-elev)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              Laatste 30 dagen
            </button>
          </div>
        </header>

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Onderschepte gesprekken"
            value={stats.gesprekken}
            delta="+3 vs vorige maand"
          />
          <StatCard
            label="Unieke daders"
            value={stats.daders}
            delta={`${stats.daders} clusters geïdentificeerd`}
          />
          <StatCard
            label="Locaties"
            value={stats.locationCount}
            delta="Unieke operatielocaties"
          />
          <StatCard
            label="Gespoofde nummers"
            value={stats.spoofedBanks}
            delta="Unieke banken geïmiteerd"
          />
        </div>

        {/* Area chart + gesprekken preview — side by side */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--background-card)] px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                Gesprekken over tijd
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(TOPIC_LABELS) as TopicFilter[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setTopicFilter(key)}
                    className={[
                      "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                      topicFilter === key
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]",
                    ].join(" ")}
                  >
                    {TOPIC_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>
            <AreaChart topic={topicFilter} />
          </div>

          <GesprekkenPreviewCard calls={calls} />
        </div>

        {/* Bottom analytics grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TactiekenCard calls={calls} />
          <StadenKaartCard locations={locations} />
          <GespoofdeNummersCard calls={calls} />
        </div>
      </div>
    </div>
  );
}
