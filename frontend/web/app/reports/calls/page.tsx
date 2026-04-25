import Link from "next/link";
import { loadVault } from "@/lib/vault-reader";
import { listReportCallIds } from "@/lib/report-reader";
import { PageShell } from "@/components/page-shell";
import { CallsTable } from "@/components/calls-table";

export const dynamic = "force-dynamic";

function BackButton() {
  return (
    <Link
      href="/reports"
      className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--background-elev)] px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
    >
      ← Terug naar dashboard
    </Link>
  );
}

export default async function CallsPage() {
  const [vault, callIds] = await Promise.all([loadVault(), listReportCallIds()]);

  return (
    <PageShell
      eyebrow="Intelligence · Reports"
      title="Gesprekken"
      subtitle="Alle onderschepte gesprekken met extracties, acties en rapportages."
      actions={<BackButton />}
    >
      <CallsTable vault={vault} callIds={callIds} />
    </PageShell>
  );
}
