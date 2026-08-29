import { buildHeatmapItems, type HeatmapBoardPayload } from "@/lib/boards/heatmap";
import { loadChannelHeatmapPayloads, toTileEntity } from "@/lib/boards/heatmap-server";
import { POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity } from "@/lib/types";

/** Tiles on the unified landing heatmap. */
export const UNIFIED_HEATMAP_TILES = 25;
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
 * Ordering within one channel.
 *
 * Board scores saturate — every leading row in every channel currently sits at
 * 999 — so a plain score sort collapses into the order the boards happened to
 * be registered in. Rate of change is the only field that still separates the
 * leaders, so it breaks the tie and the original board rank settles the rest.
 */
function byHeat(a: RankingEntity, b: RankingEntity): number {
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

/**
 * The landing page's cross-category board.
 *
 * Reads the same per-channel board payloads the desk pages render, rather than
 * the live rankings feed: that feed carries no economy rows at all and the
 * board pages drop politics, so anything derived from it can only ever show two
 * of the four categories.
 */
export async function loadUnifiedMarket(): Promise<UnifiedMarket> {
  const loaded = await Promise.all(
    POST_CHANNELS.map(async (meta) => {
      let boards: HeatmapBoardPayload[] = [];
      try {
        boards = await loadChannelHeatmapPayloads(meta.id);
      } catch {
        /* one desk failing to seed must not blank the whole landing board */
      }
      const composite = boards.length
        ? buildHeatmapItems({ boards, gender: "all", age: "all" })
        : [];
      const ranked = tagChannel([...composite].sort(byHeat), meta.id);
      return { meta, ranked };
    }),
  );

  const items = interleave(
    loaded.map((entry) => entry.ranked),
    UNIFIED_HEATMAP_TILES,
  ).map((item, index) => ({ ...item, rank: index + 1, previousRank: index + 1 }));

  const desks: ChannelDesk[] = loaded.map(({ meta, ranked }) => ({
    channel: meta.id,
    label: meta.label,
    href: meta.href,
    eyebrow: meta.eyebrow,
    top: ranked.slice(0, DESK_TOP_N),
  }));

  return { items, desks };
}
