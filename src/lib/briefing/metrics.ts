import { CATEGORIES, TYPE_ORDER } from "@/lib/categories";
import { formatCompact, formatRate, formatScore, TYPE_LABEL } from "@/lib/format";
import type { CategoryId, EntityType, MarketIndex, RankingEntity, RankingsPayload } from "@/lib/types";

const INDEX_TO_CATEGORY: Record<string, CategoryId> = {
  "k-buzz": "all",
  kpop: "kpop",
  broadcast: "tv_show",
  celebrity: "celebrity",
  influencer: "influencer",
  music: "music_chart",
  ratings: "tv_rating",
  webtoon: "webtoon",
  shorts: "shorts",
  mobile: "mobile_game",
  pcgame: "pc_game",
  console: "console_game",
};

export interface MarketSnapshot {
  payload: RankingsPayload;
  gainers: RankingEntity[];
  losers: RankingEntity[];
  volumeLeaders: RankingEntity[];
  byType: Record<EntityType, RankingEntity[]>;
  leadingSectors: { category: CategoryId; label: string; index?: MarketIndex }[];
}

export function categoryLabel(id: CategoryId): string {
  return CATEGORIES.find((item) => item.id === id)?.label ?? TYPE_LABEL[id] ?? id;
}

export function heatmapHref(category: CategoryId = "all"): string {
  return category === "all" ? "/#heatmap" : `/?category=${category}#heatmap`;
}

/** One SEO deep-dive per heatmap sector tab, excluding 종합. */
export const HEATMAP_DEEP_DIVE_CATEGORIES: CategoryId[] = [...TYPE_ORDER];

export function describeEntity(entity: RankingEntity): string {
  return `${entity.name}(${formatRate(entity.fluctuationRate)}, 버즈 ${formatScore(entity.buzzScore)}, 거래량 ${formatCompact(entity.volume)})`;
}

export function snapshotFromPayload(payload: RankingsPayload): MarketSnapshot {
  const ranked = [...payload.items];
  const gainers = [...ranked].sort((a, b) => b.fluctuationRate - a.fluctuationRate);
  const losers = [...ranked].sort((a, b) => a.fluctuationRate - b.fluctuationRate);
  const volumeLeaders = [...ranked].sort((a, b) => b.volume - a.volume);
  const byType = {} as Record<EntityType, RankingEntity[]>;
  for (const item of ranked) {
    byType[item.type] = [...(byType[item.type] ?? []), item];
  }
  for (const key of Object.keys(byType) as EntityType[]) {
    byType[key].sort((a, b) => b.fluctuationRate - a.fluctuationRate);
  }
  const leadingSectors = payload.indices
    .map((index) => ({
      category: INDEX_TO_CATEGORY[index.id] ?? "all",
      label: index.label,
      index,
    }))
    .filter((item) => item.category !== "all");
  return { payload, gainers, losers, volumeLeaders, byType, leadingSectors };
}

export function pickDeepDiveCategories(
  snapshot: MarketSnapshot,
  _editionDate: string,
  count = TYPE_ORDER.length,
): CategoryId[] {
  const withData = TYPE_ORDER.filter((type) => (snapshot.byType[type] ?? []).length > 0);
  if (withData.length >= count) return withData.slice(0, count);
  const missing = TYPE_ORDER.filter((type) => !withData.includes(type));
  return [...withData, ...missing].slice(0, count);
}
