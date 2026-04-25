"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// The demo starts "today" with this baseline. It feels plausible as a network
// aggregate for a day that's already several hours in.
const BASELINE = 4087;
// One tick per second = 1 wasted scammer-minute per second. Realistic for a
// network running dozens of honeypots in parallel.
const TICK_INTERVAL_MS = 1000;

function formatDutch(n: number): string {
  // Dutch thousands separator is a period: 4.287
  return n.toLocaleString("nl-NL");
}

// Split a Dutch-formatted number into an array of individual characters
// (digits and separators) for per-character animation.
function toChars(n: number): string[] {
  return formatDutch(n).split("");
}

interface AnimatedDigitProps {
  char: string;
  index: number;
}

function AnimatedChar({ char, index }: AnimatedDigitProps) {
  const isDigit = /\d/.test(char);

  if (!isDigit) {
    // Punctuation/separators: render statically, no animation needed.
    return (
      <span
        className="inline-block tabular-nums"
        style={{ color: "var(--muted)" }}
      >
        {char}
      </span>
    );
  }

  return (
    <span
      className="relative inline-block overflow-hidden tabular-nums"
      style={{ lineHeight: "1" }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={`${index}-${char}`}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{
            duration: 0.22,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className="inline-block"
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function ScammerMinutesCounter() {
  const [count, setCount] = useState(BASELINE);
  // Track which character positions exist across renders for stable keys.
  const chars = toChars(count);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => c + 1);
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span
        className="text-[11px] font-medium uppercase tracking-[0.22em]"
        style={{ color: "var(--accent)" }}
      >
        Scammer minutes wasted today
      </span>

      {/* The big number */}
      <div
        className="flex items-center font-mono font-bold leading-none tracking-tight"
        style={{
          fontSize: "clamp(4rem, 14vw, 10rem)",
          color: "var(--foreground)",
        }}
        aria-live="polite"
        aria-label={`${count} scammer minutes wasted today`}
      >
        {chars.map((char, i) => (
          <AnimatedChar key={i} char={char} index={i} />
        ))}
      </div>

      <span
        className="text-sm tabular-nums"
        style={{ color: "var(--muted-2)" }}
      >
        and counting&ensp;&mdash;&ensp;across all active honeypots
      </span>
    </div>
  );
}
