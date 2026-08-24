import { CATEGORIES } from "@/lib/categories";
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

export function pickDeepDiveCategories(snapshot: MarketSnapshot, editionDate: string, count = 2): CategoryId[] {
  const salt = Number(editionDate.replaceAll("-", "")) % 7;
  const scored = snapshot.leadingSectors.map((sector, order) => ({
    category: sector.category,
    score: Math.abs(sector.index?.changeRate ?? 0) * 10 + (salt + order) * 0.3,
  }));
  scored.sort((a, b) => b.score - a.score);
  const unique: CategoryId[] = [];
  for (const row of scored) {
    if (!unique.includes(row.category)) unique.push(row.category);
    if (unique.length >= count) break;
  }
  return unique.slice(0, count);
}
