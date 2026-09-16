import { unstable_cache } from "next/cache";
import { buildCategoryInfoPayload } from "@/lib/entity/category-info/build";
import { enrichCategoryInfoPayload } from "@/lib/entity/category-info/enrich";
import type { CategoryInfoPayload } from "@/lib/entity/category-info/types";
import type { RankingEntity } from "@/lib/types";

/** 1 hour — keep detail packs fresh without hammering sources each request. */
export const CATEGORY_INFO_REVALIDATE_SEC = 3600;

function cacheKey(entity: RankingEntity): string[] {
  return [
    "item-detail-category-info-v3-public-data",
    entity.slug,
    entity.type,
    entity.heatmapGroup ?? "",
    String(entity.rank),
    String(Math.round(entity.fluctuationRate * 100)),
  ];
}

async function buildAndEnrich(entity: RankingEntity): Promise<CategoryInfoPayload> {
  const base = buildCategoryInfoPayload(entity);
  try {
    return await enrichCategoryInfoPayload(base);
  } catch {
    // Soft-fail: still show curated/fallback pack if crawl is down.
    return {
      ...base,
      notice:
        base.notice ||
        "실시간 수집이 잠시 지연되어 기본 정보로 표시합니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}

/**
 * Cached builder for ItemDetailCategoryInfo.
 * Revalidates every hour; crawl enrichment runs inside the cache boundary.
 */
export async function loadCategoryInfoPayload(
  entity: RankingEntity,
): Promise<CategoryInfoPayload> {
  const cached = unstable_cache(
    async () => buildAndEnrich(entity),
    cacheKey(entity),
    { revalidate: CATEGORY_INFO_REVALIDATE_SEC },
  );
  return cached();
}
