import { ALL_CATEGORIES, TYPE_ORDER } from "@/lib/categories";
import { formatCompact, formatRate, formatScore, TYPE_LABEL } from "@/lib/format";
import { channelFromEntityType, channelHref } from "@/lib/posts/channels";
import type { CategoryId, EntityType, MarketIndex, RankingEntity, RankingsPayload } from "@/lib/types";

const INDEX_TO_CATEGORY: Record<string, CategoryId> = {
  "k-buzz": "all",
  kpop: "kpop",
  broadcast: "tv_show",
  celebrity: "celebrity",
  influencer: "influencer",
  music: "music_chart",
  ratings: "tv_rating",
  movie: "movie",
  webtoon: "webtoon",
  shorts: "shorts",
  mobile: "mobile_game",
  pcgame: "pc_game",
  console: "console_game",
  "pol-buzz": "all",
  "pol-approval": "politician_support",
  "pol-headline": "headline_news",
  "pol-party": "party_support",
  "pol-politician": "politician_support",
  "pol-pundit": "political_pundit",
  "pol-influencer": "political_influencer",
  "pol-ratings": "political_ratings",
  "pol-search": "political_search",
  "pol-policy": "local_policy",
  "pol-subsidy": "subsidy",
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
  return ALL_CATEGORIES.find((item) => item.id === id)?.label ?? TYPE_LABEL[id] ?? id;
}

export function heatmapHref(category: CategoryId = "all"): string {
  if (category === "all") return "/#heatmap";
  return `${channelHref(channelFromEntityType(category))}#heatmap`;
}

/** One SEO deep-dive per heatmap sector tab, excluding 종합. */
export const HEATMAP_DEEP_DIVE_CATEGORIES: CategoryId[] = [...TYPE_ORDER];

export function describeEntity(entity: RankingEntity): string {
  return `${entity.name}(${formatRate(entity.fluctuationRate)}, 버즈 ${formatScore(entity.buzzScore)}, 거래량 ${formatCompact(entity.volume)})`;
}

export function snapshotFromPayload(payload: RankingsPayload): MarketSnapshot {
  /** Board order only — never sort editorial triggers by rate/volume. */
  const ranked = [...payload.items].sort((a, b) => a.rank - b.rank);
  const gainers = ranked;
  const losers = [...ranked].reverse();
  const volumeLeaders = ranked;
  const byType = {} as Record<EntityType, RankingEntity[]>;
  for (const item of ranked) {
    byType[item.type] = [...(byType[item.type] ?? []), item];
  }
  for (const key of Object.keys(byType) as EntityType[]) {
    byType[key].sort((a, b) => a.rank - b.rank);
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
