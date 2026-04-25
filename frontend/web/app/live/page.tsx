"use client";

import { useMemo } from "react";
import { CallTimer } from "@/components/call-timer";
import { ExtractionSidebar } from "@/components/extraction-sidebar";
import { TranscriptStream } from "@/components/transcript-stream";
import { useBus } from "@/lib/sse";
import type { ExtractionUpdate, TranscriptDelta } from "@/lib/types";

export default function LivePage() {
  const { events, latest, reset, sessionKey } = useBus();

  const transcript = useMemo<TranscriptDelta[]>(
    () => events.filter((e): e is TranscriptDelta => e.type === "transcript_delta"),
    [events],
  );

  const extractions = useMemo<ExtractionUpdate[]>(
    () => events.filter((e): e is ExtractionUpdate => e.type === "extraction_update"),
    [events],
  );

  const callEnded = useMemo(
    () => events.find((e) => e.type === "call_ended") ?? null,
    [events],
  );

  const latestEventMs = latest && "t_offset_ms" in latest ? latest.t_offset_ms : null;
  const endedAtSeconds =
    callEnded && callEnded.type === "call_ended" ? callEnded.duration_s : null;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-6 py-6">
      {/* Header strip */}
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <CallTimer
            latestEventMs={latestEventMs}
            endedAtSeconds={endedAtSeconds}
            sessionKey={sessionKey}
          />
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Honeypot · call-0042
            </span>
            <span className="text-base font-medium text-[var(--foreground)]">
              Mevrouw Jansen — Zwolle
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={reset}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--background-elev)] px-4 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
          Replay demo
        </button>
      </header>

      {/* Main layout: transcript fills, sidebar fixed-width on desktop */}
      <div className="grid min-h-[calc(100vh-220px)] flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <TranscriptStream events={transcript} />
        <ExtractionSidebar events={extractions} />
      </div>
    </div>
  );
}
