"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/live", label: "Live" },
  { href: "/graph", label: "Graph" },
  { href: "/reports", label: "Reports" },
  { href: "/public", label: "Public" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_80%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-medium tracking-tight"
        >
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--accent)] shadow-[0_0_18px_var(--accent)]"
          />
          <span className="text-[15px] text-[var(--foreground)]">
            The Scammer&rsquo;s Mirror
          </span>
          <span className="ml-1 hidden text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] group-hover:text-[var(--foreground)] sm:inline">
            beta
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "relative rounded-md px-3 py-1.5 transition-colors",
                  active
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                ].join(" ")}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[11px] h-px bg-[var(--accent)]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
