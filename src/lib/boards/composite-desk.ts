import { buildHeatmapItems, withoutHeadlineHeatmapItems, type HeatmapBoardPayload } from "@/lib/boards/heatmap";
import { loadChannelHeatmapPayloads, loadHeatmapLivePayload, toTileEntity } from "@/lib/boards/heatmap-server";
import { countLivePreferRows, preferLiveChannelComposite } from "@/lib/boards/limits";
import { attachKospiStockQuotes } from "@/lib/market/kospi-quotes";
import { itemsForChannel, POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import { attachTimeframeMetrics, heatForTimeframe } from "@/lib/timeframes";
import { tickerChangeRate } from "@/lib/ticker/rank";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

/** Tiles on the unified landing heatmap (desktop shows all; mobile caps at 15). */
export const UNIFIED_HEATMAP_TILES = 20;
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
 * Ordering within one channel desk / heatmap pool.
 * Prefer absolute 3m move so politics·economy cards show movers, not score ties.
 */
function byHeat(a: RankingEntity, b: RankingEntity): number {
  const heat = heatForTimeframe(b, "3m") - heatForTimeframe(a, "3m");
  if (heat !== 0) return heat;
  const move = Math.abs(tickerChangeRate(b)) - Math.abs(tickerChangeRate(a));
  if (move !== 0) return move;
  if (b.buzzScore !== a.buzzScore) return b.buzzScore - a.buzzScore;
  if (b.fluctuationRate !== a.fluctuationRate) return b.fluctuationRate - a.fluctuationRate;
  return a.rank - b.rank;
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

/** Board rows for one channel, used where the live feed has no coverage. */
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
 * Cross-category heatmap pool — live-chart first when enough crawl rows exist;
 * otherwise fall back to menu-board composites.
 */
async function channelHeatmapPool(
  channel: PostChannel,
  market?: RankingsPayload,
): Promise<RankingEntity[]> {
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
  return boardPool(channel);
}

/** Uses the same 3m change field as the ticker and channel heatmap. */
function deskTopItem(item: RankingEntity): RankingEntity {
  const enriched = attachTimeframeMetrics(item);
  return toTileEntity({ ...enriched, fluctuationRate: tickerChangeRate(enriched) });
}

/**
 * The landing page's cross-category board.
 *
 * Prefers live-chart ingest (news/YouTube/tickets) when enough rows exist;
 * menu boards fill desks the snapshot does not cover yet.
 */
export async function loadUnifiedMarket(market?: RankingsPayload): Promise<UnifiedMarket> {
  const resolved = market?.items?.length ? market : loadHeatmapLivePayload();

  const loaded = await Promise.all(
    POST_CHANNELS.map(async (meta) => {
      const pool = await channelHeatmapPool(meta.id, resolved);
      const ranked = tagChannel([...pool].sort(byHeat), meta.id);
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
