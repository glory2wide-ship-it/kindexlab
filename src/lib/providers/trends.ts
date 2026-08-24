import { marketIndices, rankings, rankingsUpdatedAt } from "@/data/rankings";
import { snapshotToPayload } from "@/lib/ingestion/compose";
import { ingestLivePayload, readPersistedSnapshot } from "@/lib/ingestion/job";
import { buildTimeframeMetrics } from "@/lib/timeframes";
import type {
  CategoryId,
  RankingEntity,
  RankingsPayload,
  Timeframe,
  TrendEntity,
  TrendsPayload,
} from "@/lib/types";
import { decodeRouteSlug, slugsMatch } from "@/lib/slugs";
import { unstable_cache } from "next/cache";

/**
 * Data-source switch:
 *   TRENDS_DATA_SOURCE=live  → crawler snapshot + on-demand refresh
 *   unset / mock             → local rankings fixture
 */
export type TrendsSource = TrendsPayload["source"];

export function getTrendsSource(): TrendsSource {
  return process.env.TRENDS_DATA_SOURCE === "live" ? "live" : "mock";
}

function loadMockRankings(): RankingsPayload {
  return {
    updatedAt: rankingsUpdatedAt,
    status: "open",
    indices: marketIndices,
    items: rankings,
  };
}

const liveRevalidate = Number(process.env.TRENDS_LIVE_REVALIDATE ?? 300);
const liveRevalidateSec = Number.isFinite(liveRevalidate) ? liveRevalidate : 300;

const ingestWhenEmpty = unstable_cache(
  async () => {
    const snapshot = readPersistedSnapshot();
    const report = await ingestLivePayload({ previous: snapshot });
    if (report.payload.items.length > 0) return report.payload;
    return loadMockRankings();
  },
  ["enterbuzz-live-ingest"],
  { revalidate: liveRevalidateSec },
);

async function loadLiveRankings(): Promise<RankingsPayload> {
  const snapshot = readPersistedSnapshot();
  if (snapshot?.items.length) return snapshotToPayload(snapshot);
  try {
    return await ingestWhenEmpty();
  } catch {
    return loadMockRankings();
  }
}

export async function getRankings(): Promise<RankingsPayload> {
  return getTrendsSource() === "live" ? loadLiveRankings() : loadMockRankings();
}

export function toTrendEntity(entity: RankingEntity, timeframe: Timeframe = "1d"): TrendEntity {
  const metrics = buildTimeframeMetrics(entity);
  const snapshot = metrics[timeframe];
  return {
    id: entity.id,
    slug: entity.slug,
    name: entity.name,
    nameEn: entity.nameEn,
    category: entity.type,
    rank: entity.rank,
    previousRank: entity.previousRank,
    buzzScore: snapshot.buzzScore,
    fluctuationPct: snapshot.changeRate,
    volume: snapshot.volume,
    metrics,
    sparkline: entity.sparkline,
    tags: entity.tags,
    summary: entity.summary,
    analysis: entity.analysis,
    products: entity.products,
  };
}

export async function getTrends(options?: {
  category?: CategoryId;
  timeframe?: Timeframe;
}): Promise<TrendsPayload> {
  const payload = await getRankings();
  const timeframe = options?.timeframe ?? "1d";
  const category = options?.category ?? "all";
  const items = payload.items
    .filter((item) => category === "all" || item.type === category)
    .map((item) => toTrendEntity(item, timeframe));

  return {
    source: getTrendsSource(),
    updatedAt: payload.updatedAt,
    status: payload.status,
    timeframe,
    indices: payload.indices,
    items,
  };
}

export async function getTrendBySlug(
  slug: string,
  timeframe: Timeframe = "1d",
): Promise<TrendEntity | undefined> {
  const payload = await getRankings();
  const entity = findBySlug(payload.items, slug);
  return entity ? toTrendEntity(entity, timeframe) : undefined;
}

function findBySlug(items: RankingEntity[], slug: string): RankingEntity | undefined {
  const incoming = decodeRouteSlug(slug);
  return items.find((item) => slugsMatch(item.slug, incoming));
}

export async function getEntityBySlug(slug: string): Promise<RankingEntity | undefined> {
  const payload = await getRankings();
  return findBySlug(payload.items, slug);
}

export async function getEntitiesBySlugs(slugs: string[]): Promise<RankingEntity[]> {
  const payload = await getRankings();
  return slugs
    .map((slug) => findBySlug(payload.items, slug))
    .filter((item): item is RankingEntity => Boolean(item));
}

export async function getRelatedEntities(
  entity: RankingEntity,
  limit = 4,
): Promise<RankingEntity[]> {
  const payload = await getRankings();
  return payload.items
    .filter((item) => item.id !== entity.id && item.type === entity.type)
    .slice(0, limit);
}

export async function getAllSlugs(): Promise<string[]> {
  const payload = await getRankings();
  return payload.items.map((item) => item.slug);
}
