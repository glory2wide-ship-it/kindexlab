import { ItemDetailCategoryInfoSkeleton } from "@/components/entity/ItemDetailCategoryInfoSkeleton";
import { ItemDetailCategoryInfoView } from "@/components/entity/ItemDetailCategoryInfoView";
import { loadCategoryInfoPayload } from "@/lib/entity/category-info";
import type { RankingEntity } from "@/lib/types";

/**
 * Excel「카테고리 정리 킨덱스 0916」기반 — 히트맵 종목 상세 맞춤 정보.
 * Place above the chart box on `/ranking/[slug]`. Data revalidates hourly.
 */
export async function ItemDetailCategoryInfo({ entity }: { entity: RankingEntity }) {
  const payload = await loadCategoryInfoPayload(entity);
  return <ItemDetailCategoryInfoView payload={payload} />;
}

export { ItemDetailCategoryInfoSkeleton };
