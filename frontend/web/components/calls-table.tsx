"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { GraphData, GraphNode } from "@/lib/vault-reader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  vault: GraphData;
  callIds: string[];
}

type Stakeholder = "politie" | "bank" | "telco" | "publiek";

interface CallRow {
  id: string;
  startedAt: string;
  durationS: number;
  claimedBank: string;
  tactics: string[];
  location: string;
  script: string;
  scammer: string;
  reports: Set<Stakeholder>;
  node: GraphNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripWikilink(s: string): string {
  return s.replace(/\[\[|\]\]/g, "").trim();
}

function toIso(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const STAKEHOLDERS: Stakeholder[] = ["politie", "bank", "telco", "publiek"];
const STAKEHOLDER_LABEL: Record<Stakeholder, string> = {
  politie: "Politie",
  bank: "Bank",
  telco: "Telco",
  publiek: "Publiek",
};

function buildRows(vault: GraphData, callIds: string[]): CallRow[] {
  // callIds is the list of call IDs that have at least one report file.
  // All four stakeholders are always generated together, so if an ID is in the
  // list we treat all four as present.
  const reportSet = new Set(callIds);
  const allNodes = vault.nodes;
  const callNodes = allNodes.filter((n) => n.type === "call");

  return callNodes
    .map((node) => {
      const fm = node.frontmatter;
      const id = typeof fm.id === "string" ? fm.id : node.id;
      const startedAt = toIso(fm.started_at);
      const durationS =
        typeof fm.duration_s === "number" ? fm.duration_s : 0;
      const claimedBank =
        typeof fm.claimed_bank === "string"
          ? stripWikilink(fm.claimed_bank)
          : "—";
      const tactics = Array.isArray(fm.tactics)
        ? (fm.tactics as string[]).map(String)
        : [];

      // Resolve location: call → scammer → location node
      const scammerSlug = stripWikilink(
        typeof fm.scammer === "string" ? fm.scammer : ""
      );
      const scammerNode = allNodes.find((n) => n.id === scammerSlug);
      const locationSlug = scammerNode
        ? stripWikilink(
            typeof scammerNode.frontmatter.location === "string"
              ? scammerNode.frontmatter.location
              : ""
          )
        : "";
      const locationNode = allNodes.find((n) => n.id === locationSlug);
      const location =
        locationNode && typeof locationNode.frontmatter.city === "string"
          ? `${locationNode.frontmatter.city}, ${locationNode.frontmatter.country_code ?? ""}`
          : "—";

      const script =
        typeof fm.script === "string" ? stripWikilink(fm.script) : "—";
      const scammer =
        typeof fm.scammer === "string" ? stripWikilink(fm.scammer) : "—";

      // Which reports exist for this call?
      const hasReports = reportSet.has(id);
      const reports = new Set<Stakeholder>(
        hasReports ? STAKEHOLDERS : [],
      );

      return {
        id,
        startedAt,
        durationS,
        claimedBank,
        tactics,
        location,
        script,
        scammer,
        reports,
        node,
      };
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ durationS }: { durationS: number }) {
  const isLong = durationS > 240;
  return (
    <span
      className={[
        "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]",
        isLong
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "bg-[var(--background-elev)] text-[var(--muted)]",
      ].join(" ")}
    >
      {isLong ? "Uitgebreid" : "Kort"}
    </span>
  );
}

// ─── Report chips ─────────────────────────────────────────────────────────────

function ReportChips({ reports }: { reports: Set<Stakeholder> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {STAKEHOLDERS.map((s) => {
        const has = reports.has(s);
        return (
          <span
            key={s}
            className={[
              "rounded border px-1.5 py-0.5 text-[10px]",
              has
                ? "border-[var(--border-strong)] text-[var(--muted)]"
                : "border-[var(--border)] text-[var(--muted)]",
            ].join(" ")}
            style={has ? {} : { opacity: 0.35 }}
          >
            {STAKEHOLDER_LABEL[s]}
          </span>
        );
      })}
    </div>
  );
}

// ─── Expanded row detail ──────────────────────────────────────────────────────

function ExpandedDetail({ row }: { row: CallRow }) {
  return (
    <div className="border-t border-[var(--border)] bg-[var(--background-elev)] px-6 py-5">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Left: Extracties */}
        <div className="flex flex-col gap-3">
          <h4 className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Extracties
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
            <dt className="text-[var(--muted)]">Locatie</dt>
            <dd className="text-[var(--foreground)]">
              {row.location}
            </dd>
            <dt className="text-[var(--muted)]">Geïmiteerde bank</dt>
            <dd className="text-[var(--foreground)]">{row.claimedBank}</dd>
            <dt className="text-[var(--muted)]">Script</dt>
            <dd className="text-[var(--foreground)]">{row.script}</dd>
            <dt className="text-[var(--muted)]">Dader-koppeling</dt>
            <dd className="text-[var(--foreground)]">{row.scammer}</dd>
          </dl>
        </div>

        {/* Right: Metadata */}
        <div className="flex flex-col gap-3">
          <h4 className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Metadata
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
            <dt className="text-[var(--muted)]">Gestart</dt>
            <dd className="text-[var(--foreground)]">
              {row.startedAt ? formatDate(row.startedAt) : "—"}
            </dd>
            <dt className="text-[var(--muted)]">Tijdstip</dt>
            <dd className="text-[var(--foreground)]">
              {row.startedAt ? formatTime(row.startedAt) : "—"}
            </dd>
            <dt className="text-[var(--muted)]">Duur</dt>
            <dd className="tabular-nums text-[var(--foreground)]">
              {row.durationS ? formatDuration(row.durationS) : "—"}
            </dd>
          </dl>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
        <button className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-ink)] transition-opacity hover:opacity-90">
          Aangifte openen
        </button>
        <button className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
          Bankmelding
        </button>
        <button className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
          Telco-melding
        </button>
        <button className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
          Publiek bericht
        </button>
        <Link
          href={`/live?callId=${row.id}`}
          className="ml-auto rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          Volledig transcript ↗
        </Link>
        <Link
          href={`/live?callId=${row.id}&replay=1`}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          Live replay ↗
        </Link>
      </div>
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pb-4">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          placeholder="Zoek gesprek of tactiek…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-8 rounded-md border border-[var(--border)] bg-[var(--background-elev)] pl-7 pr-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:outline-none"
          style={{ width: 220 }}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CallsTable({ vault, callIds }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => buildRows(vault, callIds), [vault, callIds]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.claimedBank.toLowerCase().includes(q) ||
        r.tactics.some((t) => t.toLowerCase().includes(q)) ||
        r.scammer.toLowerCase().includes(q),
    );
  }, [rows, search]);

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col gap-0">
      <FilterBar search={search} onSearch={setSearch} />

      <div className="text-xs text-[var(--muted)] pb-2">
        {filtered.length} gesprekken
      </div>

      {/* Table header */}
      <div
        className="grid items-center gap-4 border-b border-[var(--border)] px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]"
        style={{
          gridTemplateColumns: "80px 100px 1fr 72px 120px 80px 148px 24px",
        }}
      >
        <span>Gesprek</span>
        <span>Datum</span>
        <span>Beschrijving &amp; tactieken</span>
        <span>Duur</span>
        <span>Bank</span>
        <span>Status</span>
        <span>Rapportages</span>
        <span />
      </div>

      {/* Rows */}
      <div className="flex flex-col divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] overflow-hidden">
        {filtered.map((row) => {
          const isExpanded = expandedId === row.id;
          return (
            <div key={row.id}>
              <button
                onClick={() => toggle(row.id)}
                className={[
                  "grid w-full items-center gap-4 px-4 py-3 text-left transition-colors",
                  isExpanded
                    ? "bg-[var(--background-elev)]"
                    : "bg-[var(--background-card)] hover:bg-[var(--background-elev)]",
                ].join(" ")}
                style={{
                  gridTemplateColumns: "80px 100px 1fr 72px 120px 80px 148px 24px",
                }}
              >
                {/* ID */}
                <span className="font-mono text-[11px] text-[var(--muted)]">
                  {row.id}
                </span>

                {/* Date */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-[var(--foreground)]">
                    {row.startedAt ? formatDate(row.startedAt) : "—"}
                  </span>
                  {row.startedAt && (
                    <span className="text-[10px] tabular-nums text-[var(--muted)]">
                      {formatTime(row.startedAt)}
                    </span>
                  )}
                </div>

                {/* Tactics */}
                <div className="flex flex-wrap gap-1 min-w-0">
                  {row.tactics.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-[var(--background-elev)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] capitalize text-[var(--muted)]"
                    >
                      {t}
                    </span>
                  ))}
                  {row.tactics.length === 0 && (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  )}
                </div>

                {/* Duration */}
                <span className="tabular-nums text-xs text-[var(--muted)]">
                  {row.durationS ? formatDuration(row.durationS) : "—"}
                </span>

                {/* Bank */}
                <span className="truncate text-xs text-[var(--foreground)]">
                  {row.claimedBank}
                </span>

                {/* Status */}
                <StatusBadge durationS={row.durationS} />

                {/* Report chips */}
                <ReportChips reports={row.reports} />

                {/* Chevron */}
                <svg
                  className={[
                    "shrink-0 text-[var(--muted)] transition-transform",
                    isExpanded ? "rotate-90" : "",
                  ].join(" ")}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              {isExpanded && <ExpandedDetail row={row} />}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            Geen gesprekken gevonden
          </div>
        )}
      </div>
    </div>
  );
}
