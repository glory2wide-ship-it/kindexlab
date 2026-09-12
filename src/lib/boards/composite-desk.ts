import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getRankings } from "@/lib/providers/trends";
import { buildHeatmapItems, type HeatmapBoardPayload } from "@/lib/boards/heatmap";
import {
  loadChannelHeatmapPayloads,
  loadHeatmapLivePayload,
  toTileEntity,
} from "@/lib/boards/heatmap-server";
import {
  DESK_TOP_N,
  LANDING_HEATMAP_TIMEFRAME,
  LANDING_PER_CHANNEL_TOP,
  type ChannelDesk,
  type UnifiedMarket,
} from "@/lib/boards/landing-constants";
import { countLivePreferRows, preferLiveChannelComposite } from "@/lib/boards/limits";
import {
  readLandingUnifiedCache,
  writeLandingUnifiedCache,
} from "@/lib/boards/landing-unified-cache";
import {
  attachKospiStockQuotes,
  enrichEntityWithCachedKospiQuote,
  entityNeedsLiveMarketQuote,
} from "@/lib/market/kospi-quotes";
import { itemsForChannel, POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import { attachTimeframeMetrics, rankItemsForTimeframe } from "@/lib/timeframes";
import { tickerChangeRate } from "@/lib/ticker/rank";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

export {
  DESK_TOP_N,
  LANDING_HEATMAP_TIMEFRAME,
  LANDING_PER_CHANNEL_TOP,
  type ChannelDesk,
  type UnifiedMarket,
} from "@/lib/boards/landing-constants";

/** Don't block landing ISR on Naver quote latency — peek cache, race, warm. */
const KOSPI_QUOTE_BUDGET_MS = 150;

/** Tiles on the unified landing heatmap (desktop shows all; mobile caps at 15). */
export const UNIFIED_HEATMAP_TILES = POST_CHANNELS.length * LANDING_PER_CHANNEL_TOP;

/**
 * Round-robin merge across desks so every category stays visible near the top.
 */
function interleave(pools: RankingEntity[][], limit: number): RankingEntity[] {
  const merged: RankingEntity[] = [];
  const seen = new Set<string>();
  const used = (item: RankingEntity) => {
    const keys = [item.id, item.slug, (item.name ?? "").replace(/\s+/g, "").toLowerCase()].filter(
      Boolean,
    );
    if (keys.some((key) => seen.has(key))) return true;
    for (const key of keys) seen.add(key);
    return false;
  };
  const cursors = new Array(pools.length).fill(0);
  while (merged.length < limit) {
    let advanced = false;
    for (let i = 0; i < pools.length && merged.length < limit; i += 1) {
      const pool = pools[i];
      let cursor = cursors[i];
      while (pool && cursor < pool.length && used(pool[cursor]!)) {
        cursor += 1;
        advanced = true;
      }
      if (!pool || cursor >= pool.length) {
        cursors[i] = cursor;
        continue;
      }
      merged.push(pool[cursor]!);
      cursors[i] = cursor + 1;
      advanced = true;
    }
    if (!advanced) break;
  }
  return merged;
}

/** Stamps the desk a tile came from so the heatmap can label it. */
function tagChannel(items: RankingEntity[], channel: PostChannel): RankingEntity[] {
  return items.map((item) => ({ ...toTileEntity(item), sourceChannel: channel }));
}

/**
 * Resolve the live rankings tape.
 * Always prefer the ingest heatmap snapshot (same source as category LIVE desks).
 * Callers may pass getRankings() seed/mock — never let that override a denser snapshot.
 */
async function resolveLiveMarket(market?: RankingsPayload): Promise<RankingsPayload | undefined> {
  const snapshot = loadHeatmapLivePayload();
  const snapCount = snapshot?.items?.length ?? 0;
  const marketCount = market?.items?.length ?? 0;
  if (snapCount > 0 && snapCount >= marketCount) return snapshot;
  if (marketCount > 0) return market;
  if (snapCount > 0) return snapshot;
  try {
    const rankings = await getRankings();
    return rankings?.items?.length ? rankings : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Same pool a category desk uses for 종합 + 성별 전체 + 연령 전체:
 * live crawl first when coverage is thick enough, otherwise board/seed composite.
 *
 * When preferLive wins, skip board I/O entirely — landing only needs top-4 live
 * rows per channel, and loading ~38 published boards was pure cold-start cost.
 */
async function channelHeatmapPool(
  channel: PostChannel,
  market?: RankingsPayload,
): Promise<RankingEntity[]> {
  const liveItems = market?.items?.length
    ? itemsForChannel(market.items, channel).map(toTileEntity)
    : [];
  const preferLive = preferLiveChannelComposite(
    channel,
    undefined,
    countLivePreferRows(liveItems, channel),
    { gender: "all", age: "all" },
  );

  let boards: HeatmapBoardPayload[] = [];
  if (!preferLive) {
    try {
      boards = await loadChannelHeatmapPayloads(channel);
    } catch {
      boards = [];
    }
  }

  return buildHeatmapItems({
    boards,
    liveItems,
    gender: "all",
    age: "all",
    preferLive,
  });
}

/**
 * Rank one channel the same way MarketWorkspace does for
 * 5분봉 + 성별 전체 + 연령 전체 (no demographic skew), then keep 1위~4위.
 */
function landingTopForChannel(pool: RankingEntity[], channel: PostChannel): RankingEntity[] {
  const ranked = rankItemsForTimeframe(pool, LANDING_HEATMAP_TIMEFRAME);
  return tagChannel(ranked.slice(0, LANDING_PER_CHANNEL_TOP), channel);
}

/** Uses the same change field as the ticker and channel heatmap (5m default). */
function deskTopItem(item: RankingEntity): RankingEntity {
  const enriched = attachTimeframeMetrics(item);
  return toTileEntity({ ...enriched, fluctuationRate: tickerChangeRate(enriched) });
}

/**
 * Apply in-process Naver peeks, then race a live attach against a short budget.
 * On timeout/miss, return peeked entities and warm the cache in the background.
 */
async function attachKospiQuotesSoft(
  targets: RankingEntity[],
  budgetMs = KOSPI_QUOTE_BUDGET_MS,
): Promise<RankingEntity[]> {
  if (!targets.some(entityNeedsLiveMarketQuote)) return targets;

  const peeked = targets.map(enrichEntityWithCachedKospiQuote);

  try {
    const live = await Promise.race([
      attachKospiStockQuotes(targets),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), budgetMs);
      }),
    ]);
    if (live) return live;
  } catch {
    // Fall through to peeked + background warm.
  }

  void attachKospiStockQuotes(targets).catch(() => undefined);
  return peeked;
}

async function buildUnifiedMarket(market?: RankingsPayload): Promise<UnifiedMarket> {
  const resolved = await resolveLiveMarket(market);

  const loaded = await Promise.all(
    POST_CHANNELS.map(async (meta) => {
      const pool = await channelHeatmapPool(meta.id, resolved);
      const ranked = landingTopForChannel(pool, meta.id);
      return { meta, ranked };
    }),
  );

  const itemsRaw = interleave(
    loaded.map((entry) => entry.ranked),
    UNIFIED_HEATMAP_TILES,
  ).map((item, index) => ({
    ...toTileEntity(item),
    rank: index + 1,
    previousRank: index + 1,
  }));

  const deskTopsRaw = loaded.map(({ ranked }) =>
    ranked.slice(0, DESK_TOP_N).map(deskTopItem),
  );

  const quoteTargets = [...itemsRaw, ...deskTopsRaw.flat()];
  const quoted = await attachKospiQuotesSoft(quoteTargets);
  const byId = new Map(quoted.map((item) => [item.id, item]));

  const items = itemsRaw.map((item) => byId.get(item.id) ?? item);
  const desks: ChannelDesk[] = loaded.map(({ meta }, index) => ({
    channel: meta.id,
    label: meta.label,
    href: meta.href,
    eyebrow: meta.eyebrow,
    top: (deskTopsRaw[index] ?? []).map((item) => byId.get(item.id) ?? item),
  }));

  const marketPayload = { items, desks };
  writeLandingUnifiedCache(marketPayload);
  return marketPayload;
}

/**
 * Cross-request Next data cache for the default landing path.
 * Keep in lockstep with page ISR / CDN s-maxage (DEFAULT_TRENDS_REVALIDATE_SEC).
 */
const cachedUnifiedMarket = unstable_cache(
  async () => buildUnifiedMarket(),
  ["unified-market-v3-5m-soft-quotes"],
  { revalidate: DEFAULT_TRENDS_REVALIDATE_SEC },
);

/** Process-local memo — covers script/tests and same-isolate repeats without Next cache. */
let processUnifiedMemo: { at: number; value: Promise<UnifiedMarket> } | undefined;
const PROCESS_UNIFIED_TTL_MS = DEFAULT_TRENDS_REVALIDATE_SEC * 1000;

function loadUnifiedMarketProcessMemo(): Promise<UnifiedMarket> {
  if (processUnifiedMemo && Date.now() - processUnifiedMemo.at < PROCESS_UNIFIED_TTL_MS) {
    return processUnifiedMemo.value;
  }
  const value = buildUnifiedMarket();
  processUnifiedMemo = { at: Date.now(), value };
  return value;
}

/**
 * The landing page's cross-category board.
 *
 * For each category, take LIVE (or board fallback) ranks 1–4 under landing
 * defaults (5분봉 · 성별 전체 · 연령 전체), then round-robin merge.
 *
 * `cache()` dedupes heatmap + desk Suspense in one request; `unstable_cache`
 * spans requests inside Next; process memo covers non-Next callers.
 * Slim disk cache short-circuits cold isolates before snapshot re-derive.
 */
export const loadUnifiedMarket = cache(async function loadUnifiedMarket(
  market?: RankingsPayload,
): Promise<UnifiedMarket> {
  if (market) return buildUnifiedMarket(market);

  const slim = readLandingUnifiedCache();
  if (slim) return slim;

  try {
    return await cachedUnifiedMarket();
  } catch {
    return loadUnifiedMarketProcessMemo();
  }
});
