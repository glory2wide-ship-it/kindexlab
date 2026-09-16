import { unstable_cache } from "next/cache";
import { buildCategoryInfoPayload } from "@/lib/entity/category-info/build";
import { resolveCategoryInfoChannel } from "@/lib/entity/category-info/channel";
import { enrichCategoryInfoPayload } from "@/lib/entity/category-info/enrich";
import { categoryInfoRevalidateSec } from "@/lib/entity/category-info/refresh-policy";
import { touchCategoryInfoRefreshTier } from "@/lib/entity/category-info/refresh-status";
import type { CategoryInfoPayload } from "@/lib/entity/category-info/types";
import type { RankingEntity } from "@/lib/types";

/** @deprecated Prefer categoryInfoRevalidateSec(channel). */
export const CATEGORY_INFO_REVALIDATE_SEC = 3600;

function cacheKey(entity: RankingEntity, channel: string): string[] {
  return [
    "item-detail-category-info-v7-tiered-refresh",
    channel,
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
    const enriched = await enrichCategoryInfoPayload(base);
    touchCategoryInfoRefreshTier(enriched.channel);
    return enriched;
  } catch {
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
 * Revalidate window follows the channel refresh-policy tier.
 */
export async function loadCategoryInfoPayload(
  entity: RankingEntity,
): Promise<CategoryInfoPayload> {
  const channel = resolveCategoryInfoChannel(entity).channel;
  const revalidate = categoryInfoRevalidateSec(channel);
  const cached = unstable_cache(
    async () => buildAndEnrich(entity),
    cacheKey(entity, channel),
    { revalidate },
  );
  return cached();
}
