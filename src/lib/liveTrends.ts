import type { RankingEntity, TrendEntity, TrendsPayload } from "@/lib/types";

export async function fetchTrendsSnapshot(): Promise<TrendsPayload | null> {
  const url = `/api/trends?category=all&timeframe=1m&refresh=1&_ts=${Date.now()}`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    if (!response.ok) {
      console.error("[kindexlab:live] /api/trends failed", response.status, response.statusText);
      return null;
    }
    const payload = (await response.json()) as Partial<TrendsPayload>;
    if (
      !Array.isArray(payload.indices) ||
      !Array.isArray(payload.items) ||
      typeof payload.updatedAt !== "string"
    ) {
      console.error("[kindexlab:live] /api/trends returned an invalid payload");
      return null;
    }
    if (payload.source === "mock") {
      console.warn("[kindexlab:live] received mock fallback, not a live scrape");
    } else {
      console.info("[kindexlab:live] snapshot", {
        updatedAt: payload.updatedAt,
        items: payload.items.length,
        source: payload.source,
      });
    }
    return payload as TrendsPayload;
  } catch (error) {
    console.error("[kindexlab:live] /api/trends request error", error);
    return null;
  }
}

export function mergeTrendItems(
  previous: RankingEntity[],
  incoming: TrendEntity[],
): RankingEntity[] {
  if (incoming.length === 0) return previous;
  const prevById = new Map(previous.map((item) => [item.id, item]));
  const prevBySlug = new Map(previous.map((item) => [item.slug, item]));
  return incoming.map((trend) => {
    const prev = prevById.get(trend.id) ?? prevBySlug.get(trend.slug);
    return {
      id: trend.id,
      slug: trend.slug,
      name: trend.name,
      nameEn: trend.nameEn,
      type: trend.category,
      rank: trend.rank,
      previousRank: trend.previousRank,
      buzzScore: trend.buzzScore,
      openScore: prev?.openScore ?? trend.buzzScore,
      fluctuationRate: Number.isFinite(trend.fluctuationPct)
        ? trend.fluctuationPct
        : (prev?.fluctuationRate ?? 0),
      volume: trend.volume,
      sparkline: trend.sparkline?.length ? trend.sparkline : (prev?.sparkline ?? []),
      history: prev?.history?.length
        ? [...prev.history.slice(-29), { t: "live", v: trend.buzzScore }]
        : (prev?.history ?? []),
      tags: trend.tags ?? prev?.tags ?? [],
      summary: trend.summary ?? prev?.summary ?? "",
      analysis: trend.analysis ?? prev?.analysis ?? "",
      products: trend.products ?? prev?.products ?? [],
      metrics: trend.metrics ?? prev?.metrics,
    };
  });
}
