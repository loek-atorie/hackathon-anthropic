"use client";

import { useEffect, useState } from "react";

interface CallTimerProps {
  /** Latest event timestamp seen (ms). Drives the timer "start". */
  latestEventMs: number | null;
  /** Final duration in seconds when call_ended has fired. null while live. */
  endedAtSeconds: number | null;
  /**
   * Stable session key. Changes when the bus is reset (Replay demo). Used to
   * re-anchor the wall-clock start without reading state inside an effect.
   */
  sessionKey: number;
}

function formatMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Big monospace mm:ss timer + LIVE pill.
 *
 * Strategy:
 *   - Idle (no events yet) → "Wachten", `00:00`.
 *   - On first event of a session, set wall-clock anchor offset by t_offset_ms
 *     so the displayed time matches call-time, not mount-time.
 *   - On call_ended, freeze on the canonical duration_s from the event.
 *   - On session reset (Replay demo), re-anchor (via React's "adjust state
 *     during render" pattern — sessionKey snapshot triggers an in-render reset).
 */
export function CallTimer({
  latestEventMs,
  endedAtSeconds,
  sessionKey,
}: CallTimerProps) {
  // "Adjusting state when a prop changes" — React's recommended pattern over
  // setState-inside-useEffect. Re-anchor when the session key flips.
  const [prevSessionKey, setPrevSessionKey] = useState(sessionKey);
  const [startWallClockMs, setStartWallClockMs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  if (sessionKey !== prevSessionKey) {
    setPrevSessionKey(sessionKey);
    setStartWallClockMs(null);
  } else if (startWallClockMs === null && latestEventMs !== null) {
    // First event of this session — capture the anchor. `now` is captured
    // on mount via the lazy `useState` initializer above; close enough to
    // wall-clock for our 4-minute demo timer.
    setStartWallClockMs(now - latestEventMs);
  }

  // Tick while live.
  useEffect(() => {
    if (endedAtSeconds !== null) return;
    if (startWallClockMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endedAtSeconds, startWallClockMs]);

  let displaySeconds = 0;
  if (endedAtSeconds !== null) {
    displaySeconds = endedAtSeconds;
  } else if (startWallClockMs !== null) {
    displaySeconds = (now - startWallClockMs) / 1000;
  }

  const idle = startWallClockMs === null;
  const live = !idle && endedAtSeconds === null;

  return (
    <div className="flex items-center gap-4">
      <span className="font-mono text-4xl font-medium tabular-nums tracking-tight text-[var(--foreground)] sm:text-5xl">
        {formatMmSs(displaySeconds)}
      </span>
      <span
        className={[
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
          live
            ? "border-red-500/40 bg-red-500/10 text-red-300"
            : "border-[var(--border)] bg-[var(--background-elev)] text-[var(--muted)]",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={[
            "h-1.5 w-1.5 rounded-full",
            live
              ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)] animate-pulse"
              : "bg-[var(--muted-2)]",
          ].join(" ")}
        />
        {live ? "Live" : idle ? "Wachten" : "Beëindigd"}
      </span>
    </div>
  );
}
