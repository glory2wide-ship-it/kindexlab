import { hash } from "@/lib/ingestion/names";
import type { PoliticsHeadline } from "@/lib/politics/headlines";
import { attachTimeframeMetrics } from "@/lib/timeframes";
import type { RankingEntity } from "@/lib/types";

export function headlinesToEntities(
  items: PoliticsHeadline[],
  group: string,
  extraTags: string[] = [],
): RankingEntity[] {
  return items.map((item, index) => {
    const rank = item.rank || index + 1;
    const heat = item.heat ?? Math.max(8, 48 - index * 1.45);
    const score = Number(Math.min(99, 42 + heat * 0.55).toFixed(2));
    const change = Number((((index % 5) - 2) * 1.35).toFixed(2));
    const spark = Array.from({ length: 12 }, (_, step) =>
      Number((score * 10 * (1 + (change / 100) * ((step - 5) / 12))).toFixed(2)),
    );
    return attachTimeframeMetrics({
      id: `headline:${hash(item.url || item.title)}:${rank}`,
      slug: `headline-${rank}-${hash(item.url || item.title).slice(0, 8)}`,
      name: item.title,
      nameEn: item.publisher,
      type: "headline_news",
      rank,
      previousRank: rank,
      buzzScore: Number((score * 10).toFixed(2)),
      openScore: Number((score * 10).toFixed(2)),
      fluctuationRate: change,
      volume: Math.max(1, Math.round(heat * 420)),
      sparkline: spark,
      history: spark.map((value, step) => ({ t: String(step), v: value })),
      tags: [item.publisher, item.source, group, ...extraTags].filter(
        (tag, i, all): tag is string => Boolean(tag) && all.indexOf(tag) === i,
      ),
      summary: item.title,
      analysis: `${item.publisher} · 내부 상세`,
      products: [],
      heatmapGroup: group,
      publishedAt: item.publishedAt,
    });
  });
}
