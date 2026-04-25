"use client";

import { useMemo, useState } from "react";
import { CallTimer } from "@/components/call-timer";
import { ExtractionSidebar } from "@/components/extraction-sidebar";
import { TranscriptStream } from "@/components/transcript-stream";
import { useBus } from "@/lib/sse";
import type { ExtractionUpdate, TranscriptDelta } from "@/lib/types";

async function triggerDemo() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  const res = await fetch(`${apiUrl}/demo/trigger`, { method: "POST" });
  if (!res.ok) throw new Error(`Demo trigger failed: ${res.status}`);
}

export default function LivePage() {
  const { events, latest, reset, sessionKey } = useBus();
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

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

  // Derive call ID from the first event that carries one, fall back to placeholder
  const activeCallId = useMemo(
    () => events.find((e) => "call_id" in e)?.call_id ?? null,
    [events],
  );

  const latestEventMs = latest && "t_offset_ms" in latest ? latest.t_offset_ms : null;
  const endedAtSeconds = callEnded?.duration_s ?? null;

  const isRealMode = Boolean(process.env.NEXT_PUBLIC_SSE_URL);

  async function handleStartDemo() {
    setTriggering(true);
    setTriggerError(null);
    try {
      await triggerDemo();
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTriggering(false);
    }
  }

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
              Honeypot · {activeCallId ?? "waiting…"}
            </span>
            <span className="text-base font-medium text-[var(--foreground)]">
              Mevrouw Jansen — Zwolle
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Show Start Demo button only when connected to real SSE */}
          {isRealMode && (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={handleStartDemo}
                disabled={triggering}
                className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-black transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50"
              >
                {triggering ? "Starting…" : "Start Demo"}
              </button>
              {triggerError && (
                <span className="text-[11px] text-red-400">{triggerError}</span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--background-elev)] px-4 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
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
            {isRealMode ? "Reset" : "Replay demo"}
          </button>
        </div>
      </header>

      {/* Main layout: transcript fills, sidebar fixed-width on desktop */}
      <div className="grid min-h-[calc(100vh-220px)] flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <TranscriptStream events={transcript} />
        <ExtractionSidebar events={extractions} />
      </div>
    </div>
  );
}
