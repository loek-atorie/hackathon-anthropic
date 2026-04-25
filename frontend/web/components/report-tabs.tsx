"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ReportMap } from "@/lib/report-reader";

// Stakeholder config — tab label, report key, send target, email address
const STAKEHOLDERS = [
  {
    key: "politie" as const,
    label: "Politie",
    sendLabel: "Send to Politie",
    email: "fraude@politie.nl",
    displayEmail: "fraude@politie.nl",
  },
  {
    key: "bank" as const,
    label: "Bank",
    sendLabel: "Send to Bank",
    email: "fraudedesk@rabobank.nl",
    displayEmail: "fraudedesk@rabobank.nl",
  },
  {
    key: "telco" as const,
    label: "Telco",
    sendLabel: "Send to Telco",
    email: "abuse@kpn.com",
    displayEmail: "abuse@kpn.com",
  },
  {
    key: "public" as const,
    label: "Publiek",
    sendLabel: "Publish alert",
    email: "publiek@scammersmirror.nl",
    displayEmail: "scammersmirror.nl/alerts",
  },
] as const;

type StakeholderKey = (typeof STAKEHOLDERS)[number]["key"];

interface ReportTabsProps {
  reports: ReportMap;
}

export function ReportTabs({ reports }: ReportTabsProps) {
  // Track which tabs have already had their "send" button clicked
  const [sent, setSent] = useState<Set<StakeholderKey>>(new Set());

  function handleSend(stakeholder: (typeof STAKEHOLDERS)[number]) {
    setSent((prev) => new Set([...prev, stakeholder.key]));
    toast.success(`Verzonden naar ${stakeholder.displayEmail}`, {
      description: `${stakeholder.label} rapport verstuurd`,
      duration: 4000,
    });
  }

  return (
    <Tabs defaultValue="politie" className="flex flex-col gap-4">
      {/* Tab bar + send button row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList
          className="w-full sm:w-auto bg-[var(--background-elev)] border border-[var(--border)] h-auto p-1 rounded-lg"
        >
          {STAKEHOLDERS.map((s) => (
            <TabsTrigger
              key={s.key}
              value={s.key}
              className="px-4 py-1.5 text-sm font-medium text-[var(--muted)] rounded-md transition-colors data-active:bg-[var(--background-card)] data-active:text-[var(--foreground)] data-active:shadow-none hover:text-[var(--foreground)]"
            >
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* Tab panels */}
      {STAKEHOLDERS.map((s) => {
        const content = reports[s.key];
        const isSent = sent.has(s.key);

        return (
          <TabsContent key={s.key} value={s.key}>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background-elev)] overflow-hidden">
              {/* Document header bar */}
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--background-card)] px-6 py-4">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em]"
                    style={{
                      color: "var(--accent)",
                      background: "var(--accent-soft)",
                      border: "1px solid rgba(212,255,58,0.3)",
                    }}
                  >
                    {s.label}
                  </span>
                  <span className="text-[12px] text-[var(--muted-2)]">
                    Stakeholder rapport
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSend(s)}
                  disabled={isSent}
                  className={[
                    "inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                    isSent
                      ? "cursor-not-allowed border-[var(--border)] bg-transparent text-[var(--muted-2)] opacity-50"
                      : "border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
                  ].join(" ")}
                >
                  {isSent ? (
                    <>
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      Verzonden
                    </>
                  ) : (
                    <>
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 2L11 13" />
                        <path d="M22 2L15 22l-4-9-9-4 20-7z" />
                      </svg>
                      {s.sendLabel}
                    </>
                  )}
                </button>
              </div>

              {/* Report body */}
              <div className="px-8 py-7">
                {content ? (
                  <div className="prose-report max-w-prose">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className="h-10 w-10 text-[var(--muted-2)]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <p className="text-sm text-[var(--muted)]">
                      Geen rapport beschikbaar voor dit gesprek.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
