import { APPROVAL_INDEX_ID, COMPOSITE_INDEX_ID } from "@/lib/ingestion/composite";
import { formatRate } from "@/lib/format";
import { isPoliticsEntityType, POLITICS_INDEX_META } from "@/lib/politics/types";
import { attachTimeframeMetrics } from "@/lib/timeframes";
import type { AffiliateProduct, EntityType, MarketIndex, RankingEntity } from "@/lib/types";

export const APPROVAL_PATH = "/approval";

const CULTURE_INDEX_TYPE: Record<string, EntityType | undefined> = {
  [COMPOSITE_INDEX_ID]: undefined,
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

export function indexEntityType(id: string): EntityType | undefined {
  if (id in CULTURE_INDEX_TYPE) return CULTURE_INDEX_TYPE[id];
  return POLITICS_INDEX_META.find((item) => item.id === id)?.type;
}

export function indexPath(id: string): string {
  if (id === APPROVAL_INDEX_ID) return APPROVAL_PATH;
  return `/index/${encodeURIComponent(id)}`;
}

export function listIndexIds(): string[] {
  return [
    ...Object.keys(CULTURE_INDEX_TYPE),
    ...POLITICS_INDEX_META.map((item) => item.id).filter((id) => id !== APPROVAL_INDEX_ID),
  ];
}

export function constituentsForIndex(id: string, items: RankingEntity[]): RankingEntity[] {
  const type = indexEntityType(id);
  if (type) return items.filter((item) => item.type === type);
  if (id === "pol-buzz") return items.filter((item) => isPoliticsEntityType(item.type));
  return items.filter((item) => !isPoliticsEntityType(item.type));
}

function uniqueProducts(items: RankingEntity[]): AffiliateProduct[] {
  const seen = new Set<string>();
  const products: AffiliateProduct[] = [];
  for (const item of items) {
    for (const product of item.products) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      products.push(product);
      if (products.length >= 6) return products;
    }
  }
  return products;
}

export function entityFromIndex(index: MarketIndex, items: RankingEntity[]): RankingEntity {
  const constituents = [...constituentsForIndex(index.id, items)].sort((a, b) => a.rank - b.rank);
  const type = indexEntityType(index.id) ?? constituents[0]?.type ?? "celebrity";
  const volume =
    constituents.reduce((sum, item) => sum + item.volume, 0) || Math.round(Math.max(index.value, 1) * 1000);
  const openScore = Number(
    (index.previousValue ?? index.value / (1 + (Number.isFinite(index.changeRate) ? index.changeRate : 0) / 100)).toFixed(
      2,
    ),
  );
  const names = constituents
    .slice(0, 3)
    .map((item) => item.name)
    .join(", ");
  const rate = formatRate(index.changeRate);
  const value = Number(index.value.toFixed(2));
  return attachTimeframeMetrics({
    id: `index-${index.id}`,
    slug: index.id,
    name: index.label,
    nameEn: index.note,
    type,
    rank: 1,
    previousRank: 1,
    buzzScore: value,
    openScore,
    fluctuationRate: Number(index.changeRate.toFixed(2)),
    volume,
    sparkline: constituents[0]?.sparkline?.length ? constituents[0].sparkline : [openScore, value],
    history: [],
    tags: [index.note],
    summary: names
      ? `${index.label}은 ${index.note}입니다. 현재 ${value.toFixed(2)} (${rate}). 상위 구성은 ${names}입니다.`
      : `${index.label}은 ${index.note}입니다. 현재 ${value.toFixed(2)} (${rate}).`,
    analysis: names
      ? `${index.label} 수급은 구성 종목의 검색·언급·차트 노출을 합산한 섹터 스냅샷입니다. 전일 대비 ${rate}이며, ${names} 등 상위 칸이 지수 방향을 이끌고 있습니다.`
      : `${index.label} 수급은 검색·언급·차트 노출을 합산한 섹터 스냅샷입니다. 전일 대비 ${rate}입니다.`,
    products: uniqueProducts(constituents),
  });
}
