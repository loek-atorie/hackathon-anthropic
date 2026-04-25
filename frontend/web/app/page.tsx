import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-24">
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-start gap-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background-elev)] px-3 py-1 text-xs text-[var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" />
          Live demo · NL
        </div>

        <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] sm:text-6xl">
          The Scammer&rsquo;s Mirror.
          <br />
          <span className="text-[var(--muted)]">
            They call. We listen.
          </span>
        </h1>

        <p className="max-w-xl text-lg leading-7 text-[var(--muted)]">
          AI honeypots that hunt scammers — every call becomes a case file
          for the police, the bank, and the public. EU-sovereign, open by
          default, federation-ready.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/live"
            className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-ink)] transition hover:brightness-110"
          >
            Open the live call
          </Link>
          <Link
            href="/graph"
            className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--border-strong)] px-5 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            See the graph
          </Link>
        </div>

        <div className="mt-10 grid w-full grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
          {[
            { k: "Honeypots", v: "50" },
            { k: "Calls today", v: "37" },
            { k: "IBANs flagged", v: "112" },
            { k: "Minutes wasted", v: "4,287" },
          ].map((stat) => (
            <div
              key={stat.k}
              className="flex flex-col gap-1 bg-[var(--background)] p-4"
            >
              <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                {stat.k}
              </span>
              <span className="font-mono text-2xl tabular-nums text-[var(--foreground)]">
                {stat.v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
