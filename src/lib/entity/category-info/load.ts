import { unstable_cache } from "next/cache";
import { buildCategoryInfoPayload } from "@/lib/entity/category-info/build";
import type { CategoryInfoPayload } from "@/lib/entity/category-info/types";
import type { RankingEntity } from "@/lib/types";

/** 1 hour — keep detail packs fresh without hammering sources each request. */
export const CATEGORY_INFO_REVALIDATE_SEC = 3600;

function cacheKey(entity: RankingEntity): string[] {
  return [
    "item-detail-category-info-v1",
    entity.slug,
    entity.type,
    entity.heatmapGroup ?? "",
    String(entity.rank),
    String(Math.round(entity.fluctuationRate * 100)),
  ];
}

/**
 * Cached builder for ItemDetailCategoryInfo.
 * Revalidates every hour; keyed by slug + light market fingerprint.
 */
export async function loadCategoryInfoPayload(
  entity: RankingEntity,
): Promise<CategoryInfoPayload> {
  const cached = unstable_cache(
    async () => buildCategoryInfoPayload(entity),
    cacheKey(entity),
    { revalidate: CATEGORY_INFO_REVALIDATE_SEC },
  );
  return cached();
}
