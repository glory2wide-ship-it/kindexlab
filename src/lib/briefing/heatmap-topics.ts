/**
 * Daily briefing topic selection from the live heatmap — same filters the
 * channel dashboard defaults to: 5m timeframe, gender 전체, age 전체.
 */

import {
  buildHeatmapItems,
  entityTypeForBoardSlug,
  stripRowQualifier,
} from "@/lib/boards/heatmap";
import { loadChannelHeatmapPayloads, toTileEntity } from "@/lib/boards/heatmap-server";
import { channelUsesBoardHeatmap } from "@/lib/boards/limits";
import { menuBoardsForChannel } from "@/lib/boards/registry";
import {
  CHANNEL_ENTITY_TYPES,
  channelFromEntityType,
  itemsForChannel,
} from "@/lib/posts/channels";
import { getRankings } from "@/lib/providers/trends";
import { TICKER_TIMEFRAME } from "@/lib/ticker/rank";
import { rankItemsForTimeframe } from "@/lib/timeframes";
import type { CategoryId, RankingEntity, Timeframe } from "@/lib/types";
import type { PostChannel } from "@/lib/posts/types";

/** Matches MarketWorkspace / ticker default. */
export const BRIEFING_HEATMAP_TIMEFRAME: Timeframe = TICKER_TIMEFRAME;

export interface HeatmapTopicPool {
  channel: PostChannel;
  timeframe: Timeframe;
  gender: "all";
  age: "all";
  /** 종합 heatmap tops after 5m rank + channel boundary filter. */
  composite: RankingEntity[];
  /** Desk / board id → tops for that rail tab. */
  byDesk: Record<string, RankingEntity[]>;
}

/** Politics deep-dive desk ids → ranking-board slugs for heatmap pulls. */
const POLITICS_DESK_TO_BOARD: Record<string, string> = {
  "pol-headline": "headline-news-ranking",
  "pol-approval": "politician-support-chart",
  "pol-party": "party-support-chart",
  "pol-politician": "politician-support-chart",
  "pol-pundit": "political-pundit-ranking",
  "pol-influencer": "political-influencer-power",
  "pol-search": "policy-controversy-index",
  "pol-policy": "governor-approval-index",
  "pol-subsidy": "government-support-fund",
};

function dedupeByName(items: RankingEntity[]): RankingEntity[] {
  const seen = new Set<string>();
  const out: RankingEntity[] = [];
  for (const item of items) {
    const key = stripRowQualifier(item.name).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...item,
      name: stripRowQualifier(item.name) || item.name,
    });
  }
  return out;
}

/**
 * 1st-pass category boundary: entity must belong to this channel's desk types
 * or carry the channel tag from the heatmap build.
 */
export function passesChannelBoundary(item: RankingEntity, channel: PostChannel): boolean {
  if (item.sourceChannel && item.sourceChannel === channel) return true;
  if (channelFromEntityType(item.type) === channel) return true;
  const allowed = CHANNEL_ENTITY_TYPES[channel];
  if (allowed.length && allowed.includes(item.type)) return true;
  if (channel === "economy" && item.type === "economy_board") return true;
  if ((channel === "culture" || channel === "travel") && item.type === "culture_board") return true;
  // Board tiles always originate from this channel's menu when loaded via loadChannelHeatmapPayloads.
  if (item.heatmapGroup && item.slug.includes("--")) return true;
  return false;
}

function rankHeatmapSlice(items: RankingEntity[], channel: PostChannel): RankingEntity[] {
  const bounded = items.filter((item) => passesChannelBoundary(item, channel));
  const ranked = rankItemsForTimeframe(bounded.length ? bounded : items, BRIEFING_HEATMAP_TIMEFRAME);
  return dedupeByName(ranked.map(toTileEntity));
}

async function loadLiveItems(channel: PostChannel): Promise<RankingEntity[]> {
  try {
    const market = await getRankings();
    return itemsForChannel(market.items ?? [], channel);
  } catch {
    return [];
  }
}

/**
 * Collects the exact topic universe the dashboard would show for
 * 종합 / each board at 5m · 전체 · 전체.
 */
export async function collectHeatmapTopics(channel: PostChannel): Promise<HeatmapTopicPool> {
  const boards = await loadChannelHeatmapPayloads(channel);
  const liveItems =
    !channelUsesBoardHeatmap(channel) || channel === "politics"
      ? await loadLiveItems(channel)
      : [];

  const compositeRaw = buildHeatmapItems({
    boards,
    liveItems,
    gender: "all",
    age: "all",
    region: "all",
    preferLive: channel === "politics",
  });
  const composite = rankHeatmapSlice(compositeRaw, channel);

  const byDesk: Record<string, RankingEntity[]> = {};
  for (const board of boards) {
    const raw = buildHeatmapItems({
      boards,
      liveItems,
      board: board.slug,
      gender: "all",
      age: "all",
      region: "all",
    });
    const ranked = rankHeatmapSlice(raw, channel);
    if (ranked.length) byDesk[board.slug] = ranked;
  }

  // Politics desk aliases so compose can look up by pol-* id.
  for (const [deskId, boardSlug] of Object.entries(POLITICS_DESK_TO_BOARD)) {
    if (byDesk[boardSlug]?.length && !byDesk[deskId]?.length) {
      byDesk[deskId] = byDesk[boardSlug]!;
    }
  }

  // When a board ranking is empty, fall back to composite filtered by entity type.
  for (const def of menuBoardsForChannel(channel)) {
    if (def.deskKind) continue;
    if (!byDesk[def.slug]?.length && composite.length) {
      const type = entityTypeForBoardSlug(def.slug);
      const typed = type ? composite.filter((item) => item.type === type) : [];
      if (typed.length) byDesk[def.slug] = typed;
    }
  }

  return {
    channel,
    timeframe: BRIEFING_HEATMAP_TIMEFRAME,
    gender: "all",
    age: "all",
    composite,
    byDesk,
  };
}

/** Topics for a main or deep-dive desk — never random seeds. */
export function topicsForBriefingDesk(
  pool: HeatmapTopicPool,
  options: { kind: "main" | "deep-dive"; deskId?: string; category?: CategoryId },
): RankingEntity[] {
  if (options.kind === "main") return pool.composite;

  const deskId = options.deskId?.trim();
  if (deskId && pool.byDesk[deskId]?.length) return pool.byDesk[deskId]!;

  const resolvedBoard = deskId ? POLITICS_DESK_TO_BOARD[deskId] : undefined;
  if (resolvedBoard && pool.byDesk[resolvedBoard]?.length) return pool.byDesk[resolvedBoard]!;

  const category = options.category;
  if (category && category !== "all") {
    const typed = pool.composite.filter((item) => item.type === category);
    if (typed.length) return typed;
  }

  return pool.composite;
}

/** Focus keyword for AI enrich — lead name from the heatmap pool. */
export function focusKeywordFromTopics(items: RankingEntity[], fallback: string): string {
  const lead = items[0];
  if (!lead?.name?.trim()) return fallback;
  return stripRowQualifier(lead.name).trim() || fallback;
}
