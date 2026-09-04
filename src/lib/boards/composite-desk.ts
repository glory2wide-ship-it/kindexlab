import { buildHeatmapItems, withoutHeadlineHeatmapItems, type HeatmapBoardPayload } from "@/lib/boards/heatmap";
import { loadChannelHeatmapPayloads, toTileEntity } from "@/lib/boards/heatmap-server";
import { channelUsesBoardHeatmap } from "@/lib/boards/limits";
import { itemsForChannel, POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import { attachTimeframeMetrics } from "@/lib/timeframes";
import { tickerChangeRate } from "@/lib/ticker/rank";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

/** Tiles on the unified landing heatmap. */
export const UNIFIED_HEATMAP_TILES = 15;
/** Rows shown on each desk summary card. */
export const DESK_TOP_N = 3;

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
 * Prefer absolute 3m move so politics·economy cards show movers, not score ties at 999.
 */
function byHeat(a: RankingEntity, b: RankingEntity): number {
  const move = Math.abs(tickerChangeRate(b)) - Math.abs(tickerChangeRate(a));
  if (move !== 0) return move;
  if (b.buzzScore !== a.buzzScore) return b.buzzScore - a.buzzScore;
  if (b.fluctuationRate !== a.fluctuationRate) return b.fluctuationRate - a.fluctuationRate;
  return a.rank - b.rank;
}

/**
 * Round-robin merge across the four desks.
 *
 * Taking a global top 25 would not produce a cross-category board: the channels
 * carry very different pool sizes (엔터 40 vs 정치 10) and their scores tie at the
 * ceiling, so one desk would crowd out the rest. Drawing one name from each desk
 * per pass guarantees every category is represented near the top while still
 * spending the remaining slots on the channels that have more to show.
 */
function interleave(pools: RankingEntity[][], limit: number): RankingEntity[] {
  const merged: RankingEntity[] = [];
  const cursors = new Array(pools.length).fill(0);
  while (merged.length < limit) {
    let advanced = false;
    for (let i = 0; i < pools.length && merged.length < limit; i += 1) {
      const pool = pools[i];
      const cursor = cursors[i];
      if (!pool || cursor >= pool.length) continue;
      merged.push(pool[cursor]);
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

/** Cross-category heatmap — prefers the ingest snapshot when a channel has live rows. */
async function channelHeatmapPool(
  channel: PostChannel,
  market?: RankingsPayload,
): Promise<RankingEntity[]> {
  // Board-driven channels (incl. politics) never surface retired headline tiles.
  if (channelUsesBoardHeatmap(channel)) {
    return boardPool(channel);
  }
  const live = market ? withoutHeadlineHeatmapItems(itemsForChannel(market.items, channel)) : [];
  if (live.length) return live;
  return boardPool(channel);
}

/** Desk summary cards — prefer live ingest (same as heatmap) so rates move every refresh. */
async function channelDeskPool(
  channel: PostChannel,
  market?: RankingsPayload,
): Promise<RankingEntity[]> {
  if (channelUsesBoardHeatmap(channel)) {
    return boardPool(channel);
  }
  const live = market ? withoutHeadlineHeatmapItems(itemsForChannel(market.items, channel)) : [];
  if (live.length) return live;
  return boardPool(channel);
}

/** Uses the same 3m change field as the ticker and channel heatmap. */
function deskTopItem(item: RankingEntity): RankingEntity {
  const enriched = attachTimeframeMetrics(item);
  return { ...enriched, fluctuationRate: tickerChangeRate(enriched) };
}

/**
 * The landing page's cross-category board.
 *
 * Prefers the ingest snapshot, which the trends workflow refreshes every three
 * minutes. The board payloads this used to read exclusively cannot move at all
 * in production: `src/data/boards/` is gitignored and Supabase is unset, so no
 * cached board ships with the deploy and every channel falls through to
 * `buildSampleBoard`, whose rows come from a hardcoded seed list ordered by
 * index. That renders identically on every request forever.
 *
 * 경제·여행 still fall back to boards when the snapshot has no channel rows;
 * synthetic 3m rates rotate each refresh window so desk cards are not frozen.
 */
export async function loadUnifiedMarket(market?: RankingsPayload): Promise<UnifiedMarket> {
  const loaded = await Promise.all(
    POST_CHANNELS.map(async (meta) => {
      const [heatmapPool, deskPoolItems] = await Promise.all([
        channelHeatmapPool(meta.id, market),
        channelDeskPool(meta.id, market),
      ]);
      const ranked = tagChannel([...heatmapPool].sort(byHeat), meta.id);
      const deskRanked = tagChannel([...deskPoolItems].sort(byHeat), meta.id);
      return { meta, ranked, deskRanked };
    }),
  );

  const items = interleave(
    loaded.map((entry) => entry.ranked),
    UNIFIED_HEATMAP_TILES,
  ).map((item, index) => ({ ...item, rank: index + 1, previousRank: index + 1 }));

  const desks: ChannelDesk[] = loaded.map(({ meta, deskRanked }) => ({
    channel: meta.id,
    label: meta.label,
    href: meta.href,
    eyebrow: meta.eyebrow,
    top: deskRanked.slice(0, DESK_TOP_N).map(deskTopItem),
  }));

  return { items, desks };
}
