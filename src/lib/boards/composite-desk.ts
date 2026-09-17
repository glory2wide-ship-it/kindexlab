import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getRankings, getTrendsSource } from "@/lib/providers/trends";
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
import { cultureFranchiseKey } from "@/lib/boards/regions";
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
 * Do NOT cross-dedupe by display name — the same title can legitimately appear
 * on two desks, and name collisions were dropping a category's 3rd/4th tile.
 * Only skip an exact id already merged.
 */
function interleave(pools: RankingEntity[][], limit: number): RankingEntity[] {
  const merged: RankingEntity[] = [];
  const seenIds = new Set<string>();
  const cursors = new Array(pools.length).fill(0);
  while (merged.length < limit) {
    let advanced = false;
    for (let i = 0; i < pools.length && merged.length < limit; i += 1) {
      const pool = pools[i];
      let cursor = cursors[i] ?? 0;
      while (pool && cursor < pool.length && seenIds.has(pool[cursor]!.id)) {
        cursor += 1;
        advanced = true;
      }
      if (!pool || cursor >= pool.length) {
        cursors[i] = cursor;
        continue;
      }
      const next = pool[cursor]!;
      merged.push(next);
      seenIds.add(next.id);
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
  // Landing tops must track the ingest snapshot — never prefer a thinner caller
  // seed/mock over a denser live tape (that previously froze wrong category 1~4).
  if (snapCount > 0 && snapCount >= marketCount) return snapshot;
  if (snapCount > 0) return snapshot;
  if (marketCount > 0) return market;
  try {
    const rankings = await getRankings();
    // Landing must not freeze fixture rankings when the live snapshot is absent.
    if (getTrendsSource() === "mock") return undefined;
    return rankings?.items?.length ? rankings : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Same pool a category desk uses for 종합 + 성별 전체 + 연령 전체:
 * live crawl first when coverage is thick enough, otherwise board/seed composite.
 *
 * Always load boards (even when preferLive wins) so live-thin pads match the
 * category 종합 desk — skipping boards previously made landing top-4 diverge.
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
  try {
    boards = await loadChannelHeatmapPayloads(channel);
  } catch {
    boards = [];
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
 * Collapse touring-show clones (위키드 성남/부산…) so one franchise cannot
 * consume multiple of the four landing slots.
 * Soft-pad without franchise collapse when still short so every desk always
 * contributes LANDING_PER_CHANNEL_TOP tiles.
 */
function landingTopForChannel(pool: RankingEntity[], channel: PostChannel): RankingEntity[] {
  const ranked = rankItemsForTimeframe(pool, LANDING_HEATMAP_TIMEFRAME);
  const picked: RankingEntity[] = [];
  const seenFranchise = new Set<string>();
  const seenIds = new Set<string>();

  const franchiseKey = (item: RankingEntity) =>
    channel === "culture" || channel === "entertainment"
      ? cultureFranchiseKey(item.name)
      : (item.name ?? "").replace(/\s+/g, "").toLowerCase();

  for (const item of ranked) {
    const key = franchiseKey(item);
    if (!key || seenFranchise.has(key) || seenIds.has(item.id)) continue;
    seenFranchise.add(key);
    seenIds.add(item.id);
    picked.push(item);
    if (picked.length >= LANDING_PER_CHANNEL_TOP) break;
  }

  // Soft pad: allow additional titles if franchise collapse left us short.
  if (picked.length < LANDING_PER_CHANNEL_TOP) {
    for (const item of ranked) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      picked.push(item);
      if (picked.length >= LANDING_PER_CHANNEL_TOP) break;
    }
  }

  return tagChannel(picked, channel);
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

  // Desk cards show the same 1~4 as the heatmap pool (not a shorter slice).
  const deskTopsRaw = loaded.map(({ ranked }) =>
    ranked.slice(0, DESK_TOP_N).map(deskTopItem),
  );

  // Quote once per id. Never let desk-top ranks (1–4 within a channel) overwrite
  // the interleaved landing display ranks (1–20) via Map last-write-wins.
  const quoteSeed = new Map<string, RankingEntity>();
  for (const item of [...itemsRaw, ...deskTopsRaw.flat()]) {
    if (!quoteSeed.has(item.id)) quoteSeed.set(item.id, item);
  }
  const quoted = await attachKospiQuotesSoft([...quoteSeed.values()]);
  const quoteById = new Map(quoted.map((item) => [item.id, item]));

  const withPreservedRank = (base: RankingEntity): RankingEntity => {
    const quotedRow = quoteById.get(base.id);
    if (!quotedRow) return base;
    return {
      ...quotedRow,
      rank: base.rank,
      previousRank: base.previousRank,
      sourceChannel: base.sourceChannel ?? quotedRow.sourceChannel,
    };
  };

  const items = itemsRaw.map(withPreservedRank);
  const desks: ChannelDesk[] = loaded.map(({ meta }, index) => ({
    channel: meta.id,
    label: meta.label,
    href: meta.href,
    eyebrow: meta.eyebrow,
    top: (deskTopsRaw[index] ?? []).map(withPreservedRank),
  }));

  const marketPayload = { items, desks };
  if (!assertLandingMarketShape(marketPayload)) {
    console.warn(
      "[landing] unified market incomplete — refusing slim cache write",
      summarizeLandingGaps(marketPayload),
    );
  } else {
    // Bind cache to live ingest clock only — skip write when built from mock/empty.
    writeLandingUnifiedCache(marketPayload, resolved?.updatedAt);
  }
  return marketPayload;
}

/** True when heatmap has 20 ranked tiles and every desk has 1~4 filled. */
export function assertLandingMarketShape(market: UnifiedMarket): boolean {
  if (market.items.length !== UNIFIED_HEATMAP_TILES) return false;
  if (market.desks.length !== POST_CHANNELS.length) return false;
  const ranks = market.items.map((item) => item.rank);
  if (new Set(ranks).size !== ranks.length) return false;
  if (!ranks.every((rank, index) => rank === index + 1)) return false;

  for (const meta of POST_CHANNELS) {
    const desk = market.desks.find((row) => row.channel === meta.id);
    if (!desk || desk.top.length !== DESK_TOP_N) return false;
    const channelTiles = market.items.filter((item) => item.sourceChannel === meta.id);
    if (channelTiles.length !== LANDING_PER_CHANNEL_TOP) return false;
  }
  return true;
}

function summarizeLandingGaps(market: UnifiedMarket): Record<string, unknown> {
  return {
    items: market.items.length,
    ranks: market.items.map((item) => item.rank),
    desks: market.desks.map((desk) => ({
      channel: desk.channel,
      top: desk.top.length,
    })),
  };
}

/**
 * Cross-request Next data cache for the default landing path.
 * Keep in lockstep with page ISR / CDN s-maxage (DEFAULT_TRENDS_REVALIDATE_SEC).
 */
const cachedUnifiedMarket = unstable_cache(
  async () => buildUnifiedMarket(),
  ["unified-market-v7-5m-per-channel-top4-snapshot-bound"],
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
