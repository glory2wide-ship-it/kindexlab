import { rankRowsToEntities, toHeatmapPayload, type HeatmapBoardPayload } from "@/lib/boards/heatmap";
import { getBoard } from "@/lib/boards/registry";
import { seedBoardIfMissing } from "@/lib/boards/seed";
import { hash } from "@/lib/ingestion/names";
import { decodeRouteSlug, slugsMatch } from "@/lib/slugs";
import { attachTimeframeMetrics } from "@/lib/timeframes";
import type { EntityType, RankingEntity } from "@/lib/types";

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "")
    .slice(0, 48);
}

function typeFromBoardChannel(channel: HeatmapBoardPayload["channel"]): EntityType {
  if (channel === "economy") return "economy_board";
  if (channel === "culture") return "culture_board";
  if (channel === "politics") return "political_search";
  return "influencer";
}

export function synthesizeKeywordEntity(
  slug: string,
  name: string,
  type: EntityType = slug.startsWith("headline") ? "headline_news" : "celebrity",
): RankingEntity {
  const keyword = name.trim() || decodeRouteSlug(slug);
  const score = 72;
  const spark = Array.from({ length: 12 }, (_, step) => Number((score * 10 * (1 + (step - 5) / 40)).toFixed(2)));
  return attachTimeframeMetrics({
    id: `keyword:${hash(slug)}`,
    slug: decodeRouteSlug(slug),
    name: keyword,
    nameEn: keyword,
    type,
    rank: 1,
    previousRank: 1,
    buzzScore: score * 10,
    openScore: score * 10,
    fluctuationRate: 0,
    volume: 1200,
    sparkline: spark,
    history: spark.map((value, step) => ({ t: String(step), v: value })),
    tags: [keyword],
    summary: `${keyword} 시세 상세`,
    analysis: `${keyword} 키워드 분석`,
    products: [],
  });
}

export async function resolveBoardEntity(slug: string): Promise<RankingEntity | undefined> {
  const decoded = decodeRouteSlug(slug);
  const sep = decoded.indexOf("--");
  if (sep <= 0) return undefined;
  const boardSlug = decoded.slice(0, sep);
  const nameKey = decoded.slice(sep + 2);
  const def = getBoard(boardSlug);
  if (!def || def.deskKind) return undefined;
  try {
    const cached = await seedBoardIfMissing(def);
    const payload = toHeatmapPayload(def, cached);
    const rows = payload.ranking ?? [];
    const entities = rankRowsToEntities(rows, payload);
    return entities.find(
      (item) => slugsMatch(item.slug, decoded) || slugifyName(item.name) === nameKey,
    );
  } catch {
    return undefined;
  }
}

export async function resolveBoardOrKeywordEntity(
  slug: string,
  fallbackName?: string,
): Promise<RankingEntity | undefined> {
  const fromBoard = await resolveBoardEntity(slug);
  if (fromBoard) return fromBoard;
  const decoded = decodeRouteSlug(slug);
  const name = fallbackName?.trim();
  if (name) {
    const type: EntityType = decoded.startsWith("headline")
      ? "headline_news"
      : decoded.includes("--")
        ? typeFromBoardChannel(getBoard(decoded.split("--")[0] ?? "")?.channel ?? "entertainment")
        : "celebrity";
    return synthesizeKeywordEntity(decoded, name, type);
  }
  if (decoded.includes("--")) {
    const guess = decoded.slice(decoded.indexOf("--") + 2).replace(/-/g, " ").trim();
    if (guess.length >= 2) return synthesizeKeywordEntity(decoded, guess);
  }
  return undefined;
}
