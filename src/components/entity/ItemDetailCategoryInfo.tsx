import { Suspense } from "react";
import { ItemDetailCategoryInfoView } from "@/components/entity/ItemDetailCategoryInfoView";
import {
  loadCategoryInfoBasePayload,
  loadCategoryInfoPayload,
} from "@/lib/entity/category-info";
import type { RankingEntity } from "@/lib/types";

/**
 * Excel「카테고리 정리 킨덱스 0916」기반 — 히트맵 종목 상세 맞춤 정보.
 *
 * Progressive paint:
 * 1) curated/detail-facts base renders immediately (no network)
 * 2) cached / live enrich swaps in when ready
 */
export function ItemDetailCategoryInfo({ entity }: { entity: RankingEntity }) {
  const base = loadCategoryInfoBasePayload(entity);
  return (
    <Suspense fallback={<ItemDetailCategoryInfoView payload={base} />}>
      <ItemDetailCategoryInfoEnriched entity={entity} />
    </Suspense>
  );
}

async function ItemDetailCategoryInfoEnriched({
  entity,
}: {
  entity: RankingEntity;
}) {
  const payload = await loadCategoryInfoPayload(entity);
  return <ItemDetailCategoryInfoView payload={payload} />;
}

export { ItemDetailCategoryInfoSkeleton } from "@/components/entity/ItemDetailCategoryInfoSkeleton";
