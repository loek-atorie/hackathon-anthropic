import { loadVault } from "@/lib/vault-reader";
import { listReportCallIds } from "@/lib/report-reader";
import { DashboardView } from "@/components/dashboard-view";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [vault, callIds] = await Promise.all([loadVault(), listReportCallIds()]);
  return <DashboardView vault={vault} callIds={callIds} />;
}
