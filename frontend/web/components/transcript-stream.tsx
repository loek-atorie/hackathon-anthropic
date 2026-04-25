"use client";

import { useEffect, useRef } from "react";
import type { TranscriptDelta } from "@/lib/types";

interface TranscriptStreamProps {
  events: TranscriptDelta[];
}

const SPEAKER_LABELS: Record<TranscriptDelta["speaker"], string> = {
  mevrouw: "Mevrouw Jansen",
  scammer: "Beller (verdacht)",
};

function formatTimestamp(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Auto-scrolling chat-style transcript.
 *
 * Auto-scroll rule: only follow the bottom if the user is already near it.
 * If they've scrolled up to read history, leave them be.
 */
export function TranscriptStream({ events }: TranscriptStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  // Track whether the user is "stuck to bottom".
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      stickRef.current = distanceFromBottom < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // On new event, scroll to bottom only if we were already there.
  useEffect(() => {
    if (!stickRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [events.length]);

  return (
    <div
      ref={scrollRef}
      className="relative flex h-full flex-col gap-4 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background-elev)] px-5 py-6 sm:px-8"
    >
      {events.length === 0 && (
        <div className="m-auto flex flex-col items-center gap-2 text-center text-sm text-[var(--muted)]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
          Wachten op het eerste audio-fragment...
        </div>
      )}

      {events.map((e, i) => {
        const isMevrouw = e.speaker === "mevrouw";
        return (
          <div
            key={`${e.t_offset_ms}-${i}`}
            className={[
              "flex w-full flex-col gap-1.5 motion-safe:animate-[fadeSlide_320ms_ease-out_both]",
              isMevrouw ? "items-start" : "items-end",
            ].join(" ")}
          >
            <div
              className={[
                "flex items-baseline gap-2 text-[11px] uppercase tracking-[0.14em]",
                isMevrouw ? "" : "flex-row-reverse",
              ].join(" ")}
            >
              <span
                className="font-medium"
                style={{
                  color: isMevrouw
                    ? "var(--speaker-mevrouw)"
                    : "var(--speaker-scammer)",
                }}
              >
                {SPEAKER_LABELS[e.speaker]}
              </span>
              <span className="font-mono tabular-nums text-[var(--muted-2)]">
                {formatTimestamp(e.t_offset_ms)}
              </span>
            </div>
            <div
              className={[
                "max-w-[78%] rounded-2xl px-4 py-3 text-[17px] leading-7",
                isMevrouw
                  ? "rounded-tl-sm border border-sky-400/20 bg-sky-400/[0.06] text-[var(--foreground)]"
                  : "rounded-tr-sm border border-red-400/20 bg-red-400/[0.06] text-[var(--foreground)]",
              ].join(" ")}
            >
              {e.text}
            </div>
          </div>
        );
      })}

      <style jsx>{`
        @keyframes fadeSlide {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
