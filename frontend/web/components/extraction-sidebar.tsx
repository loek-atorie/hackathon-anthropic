"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExtractionField, ExtractionUpdate } from "@/lib/types";
import { tacticStyle } from "@/lib/tactic-styles";

interface ExtractionSidebarProps {
  events: ExtractionUpdate[];
}

interface FieldSpec {
  field: ExtractionField;
  label: string;
  placeholder: string;
}

const FIELD_ORDER: FieldSpec[] = [
  { field: "claimed_bank", label: "Bank", placeholder: "wachten op extractie..." },
  { field: "location", label: "Locatie", placeholder: "wachten op extractie..." },
  {
    field: "callback_number",
    label: "Callback nummer",
    placeholder: "wachten op extractie...",
  },
  { field: "tactics", label: "Tactiek", placeholder: "wachten op extractie..." },
  { field: "urgency_score", label: "Urgentie", placeholder: "wachten op extractie..." },
  {
    field: "script_signature",
    label: "Script-signatuur",
    placeholder: "wachten op extractie...",
  },
];

type FieldValue = string | string[] | number | undefined;

function urgencyLabel(score: number): string {
  if (score >= 0.8) return "kritiek";
  if (score >= 0.6) return "hoog";
  if (score >= 0.4) return "matig";
  return "laag";
}

function urgencyColor(score: number): string {
  if (score >= 0.8) return "#f87171"; // red-400
  if (score >= 0.6) return "#fb923c"; // orange-400
  if (score >= 0.4) return "#facc15"; // yellow-400
  return "var(--accent)";
}

interface CardProps {
  spec: FieldSpec;
  value: FieldValue;
  /** Updated-flash key — when this changes, we re-trigger the highlight animation. */
  flashKey: number;
}

function ExtractionCard({ spec, value, flashKey }: CardProps) {
  const isEmpty = value === undefined;

  // Fire a brief border flash whenever flashKey changes (i.e. value updated).
  const [flashing, setFlashing] = useState(false);
  const firstRunRef = useRef(true);
  useEffect(() => {
    // Skip initial mount so the placeholder state doesn't flash.
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    setFlashing(true);
    const id = setTimeout(() => setFlashing(false), 700);
    return () => clearTimeout(id);
  }, [flashKey]);

  return (
    <div
      className={[
        "rounded-xl border bg-[var(--background-card)] p-4 transition-colors duration-300",
        flashing
          ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent),0_0_24px_var(--accent-soft)]"
          : "border-[var(--border)]",
      ].join(" ")}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
          {spec.label}
        </span>
        {!isEmpty && (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
        )}
      </div>

      {isEmpty ? (
        <p className="text-sm italic text-[var(--muted-2)]">{spec.placeholder}</p>
      ) : (
        <CardValue field={spec.field} value={value} />
      )}
    </div>
  );
}

function CardValue({ field, value }: { field: ExtractionField; value: FieldValue }) {
  if (value === undefined) return null;

  switch (field) {
    case "claimed_bank":
      return (
        <p className="text-xl font-medium text-[var(--foreground)]">
          {String(value)}
        </p>
      );

    case "location":
      return (
        <p className="text-xl font-medium text-[var(--foreground)]">
          {String(value)}
        </p>
      );

    case "callback_number":
      return (
        <p className="font-mono text-base tabular-nums text-[var(--foreground)]">
          {String(value)}
        </p>
      );

    case "tactics": {
      const list = Array.isArray(value) ? value : [String(value)];
      return (
        <div className="flex flex-wrap gap-1.5">
          {list.map((t) => {
            const style = tacticStyle(t);
            return (
              <span
                key={t}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
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
      );
    }

    case "urgency_score": {
      const score = typeof value === "number" ? value : Number(value);
      const pct = Math.max(0, Math.min(1, score)) * 100;
      const color = urgencyColor(score);
      return (
        <div className="flex flex-col gap-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--background-elev)]">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-sm tabular-nums text-[var(--foreground)]">
              {score.toFixed(2)}
            </span>
            <span
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color }}
            >
              {urgencyLabel(score)}
            </span>
          </div>
        </div>
      );
    }

    case "script_signature":
      return (
        <p className="font-mono text-sm text-[var(--foreground)]">
          {String(value)}
        </p>
      );

    default:
      return null;
  }
}

/**
 * Latest-value-wins map of extractions, with a per-field counter that ticks
 * each time a value comes in (drives the highlight flash).
 */
export function ExtractionSidebar({ events }: ExtractionSidebarProps) {
  const { values, flashKeys } = useMemo(() => {
    const v: Partial<Record<ExtractionField, FieldValue>> = {};
    const k: Partial<Record<ExtractionField, number>> = {};
    for (const e of events) {
      v[e.field] = e.value;
      k[e.field] = (k[e.field] ?? 0) + 1;
    }
    return { values: v, flashKeys: k };
  }, [events]);

  return (
    <aside className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      <div className="flex items-center justify-between pb-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
          Live extractie
        </span>
        <span className="text-[11px] text-[var(--muted-2)]">
          {events.length} {events.length === 1 ? "update" : "updates"}
        </span>
      </div>
      {FIELD_ORDER.map((spec) => (
        <ExtractionCard
          key={spec.field}
          spec={spec}
          value={values[spec.field]}
          flashKey={flashKeys[spec.field] ?? 0}
        />
      ))}
    </aside>
  );
}
