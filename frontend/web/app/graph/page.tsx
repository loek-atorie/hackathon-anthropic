import { GraphView } from "@/components/graph-view";
import { loadVault } from "@/lib/vault-reader";

// Always re-read the vault so updates show up in dev. Cheap on local fs.
export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const data = await loadVault();
  return (
    <div className="relative flex flex-1 flex-col">
      <GraphView initialData={data} />
    </div>
  );
}
