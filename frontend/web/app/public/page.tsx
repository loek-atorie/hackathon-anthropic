"use client";

import { ScammerMinutesCounter } from "@/components/counter";

// ---------------------------------------------------------------------------
// Hardcoded call summaries derived from the vault fixtures (calls 0032–0040).
// No server fetch needed — this page represents the *network*, not the live
// demo call. Timestamps are shown as "vandaag HH:MM" (Dutch clock format).
// ---------------------------------------------------------------------------
interface CallSummary {
  id: string;
  time: string;
  claimedBank: string;
  tactics: string[];
  durationMin: number;
}

const RECENT_CALLS: CallSummary[] = [
  {
    id: "call-0040",
    time: "vandaag 15:18",
    claimedBank: "ABN AMRO",
    tactics: ["urgency", "authority", "fear"],
    durationMin: 6,
  },
  {
    id: "call-0039",
    time: "vandaag 09:50",
    claimedBank: "ING",
    tactics: ["urgency", "fear"],
    durationMin: 3,
  },
  {
    id: "call-0038",
    time: "gisteren 11:04",
    claimedBank: "ING",
    tactics: ["urgency", "authority"],
    durationMin: 5,
  },
  {
    id: "call-0037",
    time: "gisteren 16:33",
    claimedBank: "ING",
    tactics: ["authority", "fear"],
    durationMin: 7,
  },
  {
    id: "call-0035",
    time: "di 10:40",
    claimedBank: "ING",
    tactics: ["urgency", "authority"],
    durationMin: 6,
  },
  {
    id: "call-0034",
    time: "ma 13:11",
    claimedBank: "KPN",
    tactics: ["authority", "technical"],
    durationMin: 4,
  },
];

// Tactic pill colours — match the design system's dark palette.
const TACTIC_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  urgency: {
    bg: "rgba(251, 146, 60, 0.12)",
    text: "#fb923c",
    border: "rgba(251, 146, 60, 0.3)",
  },
  authority: {
    bg: "rgba(125, 211, 252, 0.10)",
    text: "#7dd3fc",
    border: "rgba(125, 211, 252, 0.25)",
  },
  fear: {
    bg: "rgba(248, 113, 113, 0.12)",
    text: "#f87171",
    border: "rgba(248, 113, 113, 0.3)",
  },
  technical: {
    bg: "rgba(167, 139, 250, 0.12)",
    text: "#a78bfa",
    border: "rgba(167, 139, 250, 0.3)",
  },
};

function defaultTacticStyle() {
  return {
    bg: "var(--background-elev)",
    text: "var(--muted)",
    border: "var(--border-strong)",
  };
}

function CallCard({ call }: { call: CallSummary }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4 transition-colors"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span
            className="text-xs font-medium tabular-nums"
            style={{ color: "var(--muted)" }}
          >
            {call.time}
          </span>
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {call.claimedBank}
          </span>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums"
          style={{
            background: "var(--background-elev)",
            color: "var(--muted)",
            border: "1px solid var(--border)",
          }}
        >
          {call.durationMin} min
        </span>
      </div>

      {/* Tactic pills */}
      <div className="flex flex-wrap gap-1.5">
        {call.tactics.map((t) => {
          const style = TACTIC_COLORS[t] ?? defaultTacticStyle();
          return (
            <span
              key={t}
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
              style={{
                background: style.bg,
                color: style.text,
                border: `1px solid ${style.border}`,
              }}
            >
              {t}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function PublicPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-6 py-16">
      {/* ------------------------------------------------------------------ */}
      {/* Hero: the big counter. Dominant, centered, alive.                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-1 flex-col items-center justify-center pb-16 pt-8">
        <ScammerMinutesCounter />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Tagline — the emotional punctuation.                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto mb-12 max-w-2xl">
        <blockquote
          className="border-l-2 pl-5 text-xl font-medium italic leading-relaxed"
          style={{
            borderColor: "var(--accent)",
            color: "var(--foreground)",
          }}
        >
          &ldquo;Every minute is a minute they&rsquo;re not scamming
          someone&rsquo;s grandmother.&rdquo;
        </blockquote>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Recent calls grid — density without clutter.                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="pb-16">
        <div className="mb-4 flex items-center gap-3">
          <span
            className="text-[11px] font-medium uppercase tracking-[0.18em]"
            style={{ color: "var(--accent)" }}
          >
            Recent calls
          </span>
          <span
            className="h-px flex-1"
            style={{ background: "var(--border)" }}
          />
          <span
            className="text-[11px]"
            style={{ color: "var(--muted-2)" }}
          >
            anonymised · network-wide
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RECENT_CALLS.map((call) => (
            <CallCard key={call.id} call={call} />
          ))}
        </div>
      </section>
    </div>
  );
}
