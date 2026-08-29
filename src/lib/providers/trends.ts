import { marketIndices, rankings, rankingsUpdatedAt } from "@/data/rankings";
import { snapshotToPayload, buildIndices } from "@/lib/ingestion/compose";
import {
  APPROVAL_INDEX_ID,
  COMPOSITE_INDEX_ID,
  buildApprovalIndex,
  buildKindexComposite,
} from "@/lib/ingestion/composite";
import { readPersistedSnapshot, runIngestJob } from "@/lib/ingestion/job";
import { getPresidentialPolls } from "@/lib/politics/polls";
import { seedPoliticsRankings } from "@/lib/politics/seed";
import { isPoliticsEntityType, POLITICS_INDEX_META } from "@/lib/politics/types";
import { trendsRevalidateSec } from "@/lib/refresh";
import { attachTimeframeMetrics, buildTimeframeMetrics, rankItemsForTimeframe } from "@/lib/timeframes";
import type {
  CategoryId,
  RankingEntity,
  RankingsPayload,
  Timeframe,
  TrendEntity,
  TrendsPayload,
} from "@/lib/types";
import { decodeRouteSlug, slugsMatch } from "@/lib/slugs";

/**
 * Data-source switch:
 *   TRENDS_DATA_SOURCE=live  → crawler snapshot + on-demand refresh
 *   TRENDS_DATA_SOURCE=mock  → local rankings fixture
 *   unset on Vercel          → live (production default)
 *   unset locally            → mock
 */
export type TrendsSource = TrendsPayload["source"];

export function getTrendsSource(): TrendsSource {
  if (process.env.TRENDS_DATA_SOURCE === "mock") return "mock";
  if (process.env.TRENDS_DATA_SOURCE === "live") return "live";
  return process.env.VERCEL ? "live" : "mock";
}

function loadMockRankings(): RankingsPayload {
  console.warn("[kindexlab:trends] using mock fixture");
  const items = [
    ...rankings,
    ...seedPoliticsRankings().filter((item) => !rankings.some((row) => row.slug === item.slug)),
  ];
  return {
    updatedAt: rankingsUpdatedAt,
    status: "open",
    indices: marketIndices,
    items,
  };
}

let ingestGate: Promise<RankingsPayload> | null = null;

function snapshotAgeMs(updatedAt?: string): number {
  if (!updatedAt) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(updatedAt);
  return Number.isFinite(parsed) ? Date.now() - parsed : Number.POSITIVE_INFINITY;
}

function isNextProductionBuild() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

async function ingestFreshRankings(): Promise<RankingsPayload> {
  if (ingestGate) return ingestGate;
  ingestGate = (async () => {
    const previous = readPersistedSnapshot();
    const started = Date.now();
    try {
      const persist =
        !isNextProductionBuild() &&
        process.env.VERCEL !== "1" &&
        (process.env.TRENDS_PERSIST_LIVE === "1" ||
          (process.env.NODE_ENV === "production" && process.env.TRENDS_PERSIST_LIVE !== "0"));
      const report = await runIngestJob({ persist });
      const emptySources = report.sourceResults
        .filter((source) => !source.ok)
        .map((source) => ({ id: source.id, count: source.count, reason: source.error }));
      console.info("[kindexlab:ingest]", {
        ms: Date.now() - started,
        persisted: report.persisted,
        usedPreviousSnapshot: report.usedPreviousSnapshot,
        itemCount: report.itemCount,
        updatedAt: report.updatedAt,
        sources: report.sourceResults.map((source) => ({
          id: source.id,
          ok: source.ok,
          count: source.count,
        })),
        empty: emptySources,
      });
      if (report.usedPreviousSnapshot) {
        console.warn("[kindexlab:ingest] scrape returned no rows; serving previous snapshot");
      }
      if (report.payload.items.length > 0) return report.payload;
      console.warn("[kindexlab:ingest] empty payload, falling back");
      if (previous?.items.length) return snapshotToPayload(previous);
      return loadMockRankings();
    } catch (error) {
      console.error("[kindexlab:ingest] scrape failed", error);
      if (previous?.items.length) return snapshotToPayload(previous);
      return loadMockRankings();
    } finally {
      ingestGate = null;
    }
  })();
  return ingestGate;
}

async function loadLiveRankings(options?: { refresh?: boolean }): Promise<RankingsPayload> {
  const snapshot = readPersistedSnapshot();
  if (isNextProductionBuild() && snapshot?.items.length) {
    return snapshotToPayload(snapshot);
  }
  const maxAgeMs = trendsRevalidateSec() * 1000;
  const stale = !snapshot?.items.length || snapshotAgeMs(snapshot.updatedAt) >= maxAgeMs;
  if (!options?.refresh && snapshot?.items.length && !stale) {
    return snapshotToPayload(snapshot);
  }
  return ingestFreshRankings();
}

export async function getRankings(options?: { refresh?: boolean }): Promise<RankingsPayload> {
  const payload = getTrendsSource() === "live" ? await loadLiveRankings(options) : loadMockRankings();
  const items = payload.items.map(attachTimeframeMetrics);
  const cultureItems = items.filter((item) => !isPoliticsEntityType(item.type));
  const politicsItems = items.filter((item) => isPoliticsEntityType(item.type));
  const polls = await getPresidentialPolls();
  const composite = buildKindexComposite({
    cultureItems,
    politicsItems,
    polls,
    previous: payload.indices,
  });
  const approval = buildApprovalIndex(polls, payload.indices);
  const cultureIndices = buildIndices(cultureItems, payload.indices).filter(
    (index) => index.id !== COMPOSITE_INDEX_ID,
  );
  const politicsIndices = buildIndices(politicsItems, payload.indices, POLITICS_INDEX_META).map((index) =>
    index.id === APPROVAL_INDEX_ID ? approval : index,
  );
  return {
    ...payload,
    items,
    indices: [composite, ...cultureIndices, ...politicsIndices],
  };
}

export function toTrendEntity(entity: RankingEntity, timeframe: Timeframe = "1d"): TrendEntity {
  const metrics = entity.metrics ?? buildTimeframeMetrics(entity);
  const snapshot = metrics[timeframe] ?? metrics["1m"];
  return {
    id: entity.id,
    slug: entity.slug,
    name: entity.name,
    nameEn: entity.nameEn,
    category: entity.type,
    rank: entity.rank,
    previousRank: entity.previousRank,
    buzzScore: entity.buzzScore,
    fluctuationPct: snapshot?.changeRate ?? entity.fluctuationRate,
    volume: entity.volume,
    metrics,
    sparkline: entity.sparkline,
    tags: entity.tags,
    summary: entity.summary,
    analysis: entity.analysis ?? "",
    products: entity.products ?? [],
  };
}

export async function getTrends(options?: {
  category?: CategoryId;
  timeframe?: Timeframe;
  refresh?: boolean;
}): Promise<TrendsPayload> {
  const payload = await getRankings({ refresh: options?.refresh });
  const timeframe = options?.timeframe ?? "1d";
  const category = options?.category ?? "all";
  const filtered = payload.items.filter((item) => category === "all" || item.type === category);
  const items = rankItemsForTimeframe(filtered, timeframe).map((item) =>
    toTrendEntity(item, timeframe),
  );

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

export async function getEntityBySlug(
  slug: string,
  fallbackName?: string,
): Promise<RankingEntity | undefined> {
  const payload = await getRankings();
  const live = findBySlug(payload.items, slug);
  if (live) return live;
  const { resolveBoardOrKeywordEntity } = await import("@/lib/entity/resolve");
  return resolveBoardOrKeywordEntity(slug, fallbackName);
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
