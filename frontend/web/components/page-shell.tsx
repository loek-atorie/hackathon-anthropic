import type { ReactNode } from "react";

interface PageShellProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  actions?: ReactNode;
}

/**
 * Shared page wrapper used by the four route stubs. Centralises the header
 * styling so later phases can drop content in without re-implementing chrome.
 */
export function PageShell({
  eyebrow,
  title,
  subtitle,
  children,
  actions,
}: PageShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-3 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          {eyebrow && (
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
              {eyebrow}
            </span>
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            {title}
          </h1>
          {subtitle && (
            <p className="max-w-2xl text-sm text-[var(--muted)]">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <section className="flex flex-1 flex-col">{children}</section>
    </div>
  );
}

interface ComingSoonProps {
  phase: string;
  description: string;
}

export function ComingSoon({ phase, description }: ComingSoonProps) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--background-elev)] p-12">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
          Coming in {phase}
        </span>
        <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
    </div>
  );
}
