export const TACTIC_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  urgency:   { bg: "rgba(251,146,60,0.15)",  text: "#fb923c", border: "rgba(251,146,60,0.4)" },
  authority: { bg: "rgba(125,211,252,0.15)", text: "#7dd3fc", border: "rgba(125,211,252,0.4)" },
  fear:      { bg: "rgba(248,113,113,0.15)", text: "#f87171", border: "rgba(248,113,113,0.4)" },
  technical: { bg: "rgba(192,132,252,0.15)", text: "#c084fc", border: "rgba(192,132,252,0.4)" },
};

export const DEFAULT_TACTIC_STYLE = { bg: "rgba(255,255,255,0.05)", text: "var(--muted)", border: "var(--border)" };

export function tacticStyle(tactic: string) {
  return TACTIC_COLORS[tactic.toLowerCase()] ?? DEFAULT_TACTIC_STYLE;
}
