import { rankRowsToEntities, toHeatmapPayload, type HeatmapBoardPayload } from "@/lib/boards/heatmap";
import { entityTypeForBoardSlug } from "@/lib/boards/entity-type";
import { getBoard } from "@/lib/boards/registry";
import { seedBoardIfMissing } from "@/lib/boards/seed";
import { hash, normalizeName } from "@/lib/ingestion/names";
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

/** Compact key shared by ingest slugs (`브루노마스내한공연`) and display names. */
export function entityNameKey(nameOrSlugTail: string): string {
  return normalizeName(nameOrSlugTail.replace(/-/g, " "));
}

function typeFromBoardChannel(channel: HeatmapBoardPayload["channel"]): EntityType {
  if (channel === "economy") return "economy_board";
  if (channel === "culture" || channel === "travel") return "culture_board";
  if (channel === "politics") return "political_search";
  return "influencer";
}

/**
 * Placeholder only — never a real board rank. Detail pages must not claim "1위"
 * when board/live lookup missed (slug hyphenation / bracket mismatches).
 */
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
    // 0 = pending; index blurb must not invent a board position.
    rank: 0,
    previousRank: 0,
    buzzScore: score * 10,
    openScore: score * 10,
    fluctuationRate: 0,
    volume: 1200,
    sparkline: spark,
    history: spark.map((value, step) => ({ t: String(step), v: value })),
    tags: [keyword, "rank-pending"],
    summary: `${keyword} 순위 데이터를 확인하는 중입니다.`,
    analysis: `${keyword} 키워드 분석`,
    products: [],
  });
}

export function entityMatchesBoardNameKey(entity: RankingEntity, nameKey: string): boolean {
  const compact = entityNameKey(nameKey);
  if (!compact) return false;
  if (entityNameKey(entity.name) === compact) return true;
  if (slugifyName(entity.name) === nameKey) return true;
  if (slugifyName(entity.name).replace(/-/g, "") === compact) return true;
  const tail = entity.slug.includes("--") ? entity.slug.slice(entity.slug.indexOf("--") + 2) : entity.slug;
  if (tail === nameKey) return true;
  if (entityNameKey(tail) === compact) return true;
  return false;
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
    // Aliased board slugs keep old URL prefixes; match by normalized name when
    // ingest compact slugs (`브루노마스…`) diverge from board hyphen slugs (`경기-브루노-…`).
    return entities.find(
      (item) =>
        slugsMatch(item.slug, decoded) ||
        slugifyName(item.name) === nameKey ||
        item.slug.endsWith(`--${nameKey}`) ||
        entityMatchesBoardNameKey(item, nameKey),
    );
  } catch {
    return undefined;
  }
}

/**
 * Peers on the same ranking board (economy / culture / travel heatmaps).
 * Live `getRankings()` rarely carries these board rows, so type-based related
 * lookups were leaving "같은 섹터 종목" empty on detail pages.
 */
export async function relatedEntitiesFromSameBoard(
  entity: RankingEntity,
  limit = 8,
): Promise<RankingEntity[]> {
  const decoded = decodeRouteSlug(entity.slug);
  const sep = decoded.indexOf("--");
  if (sep <= 0) return [];
  const boardSlug = decoded.slice(0, sep);
  const def = getBoard(boardSlug);
  if (!def || def.deskKind) return [];
  try {
    const cached = await seedBoardIfMissing(def);
    const payload = toHeatmapPayload(def, cached);
    const entities = rankRowsToEntities(payload.ranking ?? [], payload);
    return entities
      .filter((item) => {
        if (item.id === entity.id) return false;
        if (item.name === entity.name) return false;
        if (slugsMatch(item.slug, entity.slug)) return false;
        if (item.slug.toLowerCase() === entity.slug.toLowerCase()) return false;
        if (entityNameKey(item.name) === entityNameKey(entity.name)) return false;
        return true;
      })
      .slice(0, Math.max(1, limit));
  } catch {
    return [];
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
    const boardSlug = decoded.includes("--") ? decoded.split("--")[0] ?? "" : "";
    const type: EntityType = decoded.startsWith("headline")
      ? "headline_news"
      : boardSlug
        ? entityTypeForBoardSlug(boardSlug) ??
          typeFromBoardChannel(getBoard(boardSlug)?.channel ?? "entertainment")
        : "celebrity";
    return synthesizeKeywordEntity(decoded, name, type);
  }
  if (decoded.includes("--")) {
    const boardSlug = decoded.split("--")[0] ?? "";
    const guess = decoded.slice(decoded.indexOf("--") + 2).replace(/-/g, " ").trim();
    const type =
      entityTypeForBoardSlug(boardSlug) ??
      typeFromBoardChannel(getBoard(boardSlug)?.channel ?? "entertainment");
    if (guess.length >= 2) return synthesizeKeywordEntity(decoded, guess, type);
  }
  return undefined;
}
