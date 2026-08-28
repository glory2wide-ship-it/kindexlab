import { CompositeIndexBar } from "@/components/dashboard/CompositeIndexBar";
import { COMPOSITE_INDEX_ID } from "@/lib/ingestion/composite";
import { getRankings } from "@/lib/providers/trends";

export async function CompositeIndexBarSlot() {
  const market = await getRankings();
  const index = market.indices.find((item) => item.id === COMPOSITE_INDEX_ID);
  if (!index) return null;
  return <CompositeIndexBar initial={index} updatedAt={market.updatedAt} />;
}
