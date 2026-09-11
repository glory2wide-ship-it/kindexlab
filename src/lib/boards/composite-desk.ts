import { buildHeatmapItems, withoutHeadlineHeatmapItems, type HeatmapBoardPayload } from "@/lib/boards/heatmap";
import { loadChannelHeatmapPayloads, loadHeatmapLivePayload, toTileEntity } from "@/lib/boards/heatmap-server";
import { countLivePreferRows, preferLiveChannelComposite } from "@/lib/boards/limits";
import { attachKospiStockQuotes } from "@/lib/market/kospi-quotes";
import { itemsForChannel, POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import { attachTimeframeMetrics, rankItemsForTimeframe } from "@/lib/timeframes";
import { tickerChangeRate } from "@/lib/ticker/rank";
import type { RankingEntity, RankingsPayload, Timeframe } from "@/lib/types";

/**
 * Landing heatmap defaults — match MarketWorkspace desktop options:
 * 3분봉 · 성별 전체 · 연령 전체.
 */
export const LANDING_HEATMAP_TIMEFRAME: Timeframe = "3m";
/** Top N per category under those defaults (5 channels × 4 = 20 tiles). */
export const LANDING_PER_CHANNEL_TOP = 4;
/** Tiles on the unified landing heatmap (desktop shows all; mobile caps at 15). */
export const UNIFIED_HEATMAP_TILES = POST_CHANNELS.length * LANDING_PER_CHANNEL_TOP;
/** Rows shown on each desk summary card. */
export const DESK_TOP_N = 3;
/** Prefer live ingest once a desk has at least this many rows. */
const MIN_LIVE_CHANNEL_ROWS = 3;

export interface ChannelDesk {
  channel: PostChannel;
  label: string;
  href: string;
  eyebrow: string;
  top: RankingEntity[];
}

export interface UnifiedMarket {
  /** Cross-category tiles for the landing heatmap, already capped and re-ranked. */
  items: RankingEntity[];
  desks: ChannelDesk[];
}

/**
 * Round-robin merge across desks so every category stays visible near the top.
 */
function interleave(pools: RankingEntity[][], limit: number): RankingEntity[] {
  const merged: RankingEntity[] = [];
  const seen = new Set<string>();
  const used = (item: RankingEntity) => {
    const keys = [item.id, item.slug, (item.name ?? "").replace(/\s+/g, "").toLowerCase()].filter(Boolean);
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

/** Board rows for one channel (성별 전체 · 연령 전체) — same filters as the landing toolbar. */
async function boardPool(channel: PostChannel): Promise<RankingEntity[]> {
  let boards: HeatmapBoardPayload[] = [];
  try {
    boards = await loadChannelHeatmapPayloads(channel);
  } catch {
    /* one desk failing to seed must not blank the whole landing board */
  }
  return boards.length ? buildHeatmapItems({ boards, gender: "all", age: "all" }) : [];
}

/**
 * Landing heatmap pool per channel.
 * Prefer each category's 종합 board composite, then live-chart ingest when boards are thin.
 */
async function channelHeatmapPool(
  channel: PostChannel,
  market?: RankingsPayload,
): Promise<RankingEntity[]> {
  const boards = await boardPool(channel);
  if (boards.length >= MIN_LIVE_CHANNEL_ROWS) return boards;

  const live = market
    ? withoutHeadlineHeatmapItems(itemsForChannel(market.items, channel)).map(attachTimeframeMetrics)
    : [];
  const liveCount = countLivePreferRows(live, channel);
  if (preferLiveChannelComposite(channel, undefined, liveCount, MIN_LIVE_CHANNEL_ROWS)) {
    const chart = live.filter((item) => item.tags?.includes("live-chart"));
    const nonTape = live.filter(
      (item) => !item.tags?.includes("board-tape") && !item.tags?.includes("live-chart"),
    );
    const preferred = chart.length || nonTape.length ? [...chart, ...nonTape] : live;
    if (preferred.length >= MIN_LIVE_CHANNEL_ROWS) return preferred;
  }
  if (live.length >= MIN_LIVE_CHANNEL_ROWS && liveCount >= MIN_LIVE_CHANNEL_ROWS) {
    return live.filter((item) => !item.tags?.includes("board-tape"));
  }
  return boards;
}

/**
 * Rank one channel the same way MarketWorkspace does for
 * 3분봉 + 성별 전체 + 연령 전체 (no demographic skew), then keep 1위~4위.
 */
function landingTopForChannel(pool: RankingEntity[], channel: PostChannel): RankingEntity[] {
  const ranked = rankItemsForTimeframe(pool, LANDING_HEATMAP_TIMEFRAME);
  return tagChannel(ranked.slice(0, LANDING_PER_CHANNEL_TOP), channel);
}

/** Uses the same 3m change field as the ticker and channel heatmap. */
function deskTopItem(item: RankingEntity): RankingEntity {
  const enriched = attachTimeframeMetrics(item);
  return toTileEntity({ ...enriched, fluctuationRate: tickerChangeRate(enriched) });
}

/**
 * The landing page's cross-category board.
 *
 * For each category, take ranks 1–4 under landing defaults (3분봉 · 성별 전체 ·
 * 연령 전체), then round-robin merge so every desk contributes equally.
 */
export async function loadUnifiedMarket(market?: RankingsPayload): Promise<UnifiedMarket> {
  const resolved = market?.items?.length ? market : loadHeatmapLivePayload();

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
  const quoted = await attachKospiStockQuotes(quoteTargets);
  const byId = new Map(quoted.map((item) => [item.id, item]));

  const items = itemsRaw.map((item) => byId.get(item.id) ?? item);
  const desks: ChannelDesk[] = loaded.map(({ meta }, index) => ({
    channel: meta.id,
    label: meta.label,
    href: meta.href,
    eyebrow: meta.eyebrow,
    top: (deskTopsRaw[index] ?? []).map((item) => byId.get(item.id) ?? item),
  }));

  return { items, desks };
}
