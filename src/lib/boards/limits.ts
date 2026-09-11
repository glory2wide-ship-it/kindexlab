import { isLivePreferEntity } from "@/lib/boards/live-priority";
import { POLITICS_HEATMAP_BOARD_NAV, TRAVEL_HEATMAP_BOARD_NAV } from "@/lib/constants/nav";
import {
  CULTURE_EVENT_REGION_CATALOG_MIN,
  EXHIBITION_BOARD_SLUG,
  PERFORMANCE_BOARD_SLUG,
} from "@/lib/boards/region-catalogs";
import type { BoardDefinition } from "@/lib/boards/types";
import type { PostChannel } from "@/lib/posts/types";

/** Default ranked rows per channel — enough for list top-30; heatmap caps separately at 20/15. */
export const DEFAULT_CHANNEL_HEATMAP_TILES = 30;
export const ENTERTAINMENT_HEATMAP_TILES = DEFAULT_CHANNEL_HEATMAP_TILES;
export const ECONOMY_HEATMAP_TILES = DEFAULT_CHANNEL_HEATMAP_TILES;
export const CULTURE_HEATMAP_TILES = DEFAULT_CHANNEL_HEATMAP_TILES;
export const TRAVEL_HEATMAP_TILES = DEFAULT_CHANNEL_HEATMAP_TILES;
export const POLITICS_HEATMAP_TILES = DEFAULT_CHANNEL_HEATMAP_TILES;
export const DEFAULT_HEATMAP_TILES = 30;
/** 정당 지지도 랭킹 board tile cap. */
export const PARTY_SUPPORT_HEATMAP_TILES =
  POLITICS_HEATMAP_BOARD_NAV["party-support-chart"].heatmapLimit;
/** 정치인 지지도 랭킹 board tile cap. */
export const POLITICIAN_SUPPORT_HEATMAP_TILES =
  POLITICS_HEATMAP_BOARD_NAV["politician-support-chart"].heatmapLimit;

/** 공연·전시 지역 탭은 시/도당 20종목. */
export const CULTURE_EVENT_REGION_HEATMAP_TILES = CULTURE_EVENT_REGION_CATALOG_MIN;

export function isTravelRegionalHeatmapBoard(slug: string): slug is keyof typeof TRAVEL_HEATMAP_BOARD_NAV {
  return slug === "domestic-travel-ranking" || slug === "weekend-outing-ranking";
}

export function isCultureEventRegionalBoard(slug: string): boolean {
  return slug === PERFORMANCE_BOARD_SLUG || slug === EXHIBITION_BOARD_SLUG;
}

/** True when a region tab is actively selected (not 전체/all). */
export function isRegionHeatmapFilter(region?: string | null): boolean {
  return Boolean(region && region !== "all" && region !== "전체");
}

export function rankLimitForBoard(
  board: Pick<BoardDefinition, "channel" | "slug">,
  region?: string | null,
): number {
  if (board.slug === "party-support-chart") return PARTY_SUPPORT_HEATMAP_TILES;
  if (board.slug === "politician-support-chart") return POLITICIAN_SUPPORT_HEATMAP_TILES;
  if (isTravelRegionalHeatmapBoard(board.slug)) {
    const meta = TRAVEL_HEATMAP_BOARD_NAV[board.slug];
    return isRegionHeatmapFilter(region) ? meta.heatmapLimitRegion : meta.heatmapLimitAll;
  }
  if (isCultureEventRegionalBoard(board.slug) && isRegionHeatmapFilter(region)) {
    return CULTURE_EVENT_REGION_HEATMAP_TILES;
  }
  return rankLimitForChannel(board.channel);
}
/** How many names each entertainment board contributes to 종합. */
export const ENTERTAINMENT_COMPOSITE_PER_BOARD = 4;
export const ECONOMY_COMPOSITE_PER_BOARD = 4;
export const CULTURE_COMPOSITE_PER_BOARD = 4;
export const TRAVEL_COMPOSITE_PER_BOARD = 4;
export const DEFAULT_COMPOSITE_PER_BOARD = 2;
export const ENTERTAINMENT_SEGMENT_SIZE = 12;
export const ECONOMY_SEGMENT_SIZE = 12;
export const CULTURE_SEGMENT_SIZE = 20;
export const TRAVEL_SEGMENT_SIZE = 20;
export const DEFAULT_SEGMENT_SIZE = 5;

export function channelUsesBoardHeatmap(channel: PostChannel): boolean {
  return (
    channel === "economy" ||
    channel === "culture" ||
    channel === "travel" ||
    channel === "entertainment" ||
    channel === "politics"
  );
}

/**
 * Count rows that qualify as live crawl for composite heatmaps.
 * Economy/culture/travel board-tape (published/LLM) must not inflate the live gate.
 */
export function countLivePreferRows(
  items: { type?: string; tags?: string[] | null }[],
  channel: PostChannel,
): number {
  if (channel === "economy" || channel === "culture" || channel === "travel") {
    return items.filter((item) => isLivePreferEntity(item)).length;
  }
  // Entertainment / politics: native charts + live-chart count; exclude board-tape.
  return items.filter((item) => isLivePreferEntity(item)).length;
}

export type PreferLiveHeatmapOptions = {
  minLive?: number;
  /** When a gender/age segment is active, never prefer live — live tape is unsegmented. */
  gender?: string;
  age?: string;
};

/**
 * Prefer live crawl for channel 종합 and individual menus when enough live rows exist.
 * Falls back to board/demographic rankings when the live pool is thin.
 *
 * Gender/age tabs must disable live-first: the crawl tape has no demographic
 * slices, so preferLive would paint the same tiles for 남성/여성/20대/….
 */
export function preferLiveChannelComposite(
  channel: PostChannel,
  board: string | undefined | null,
  liveCount: number,
  minLiveOrOptions: number | PreferLiveHeatmapOptions = 3,
): boolean {
  const options =
    typeof minLiveOrOptions === "number" ? { minLive: minLiveOrOptions } : minLiveOrOptions;
  const minLive = options.minLive ?? 3;
  const gender = options.gender ?? "all";
  const age = options.age ?? "all";
  if (gender !== "all" || age !== "all") return false;
  void board;
  void channel;
  return liveCount >= minLive;
}

export function rankLimitForChannel(channel: PostChannel): number {
  if (channel === "entertainment") return ENTERTAINMENT_HEATMAP_TILES;
  if (channel === "economy") return ECONOMY_HEATMAP_TILES;
  if (channel === "culture") return CULTURE_HEATMAP_TILES;
  if (channel === "travel") return TRAVEL_HEATMAP_TILES;
  if (channel === "politics") return POLITICS_HEATMAP_TILES;
  return DEFAULT_HEATMAP_TILES;
}

export function segmentLimitForBoard(board: Pick<BoardDefinition, "channel">): number {
  if (board.channel === "entertainment") return ENTERTAINMENT_SEGMENT_SIZE;
  if (board.channel === "economy") return ECONOMY_SEGMENT_SIZE;
  if (board.channel === "culture") return CULTURE_SEGMENT_SIZE;
  if (board.channel === "travel") return TRAVEL_SEGMENT_SIZE;
  return DEFAULT_SEGMENT_SIZE;
}

export function compositePerBoard(channel: PostChannel): number {
  if (channel === "entertainment") return ENTERTAINMENT_COMPOSITE_PER_BOARD;
  if (channel === "economy") return ECONOMY_COMPOSITE_PER_BOARD;
  if (channel === "culture") return CULTURE_COMPOSITE_PER_BOARD;
  if (channel === "travel") return TRAVEL_COMPOSITE_PER_BOARD;
  return DEFAULT_COMPOSITE_PER_BOARD;
}

export function formatHeatmapRank(rank: number): string {
  const safe = Number.isFinite(rank) && rank > 0 ? Math.round(rank) : 1;
  return String(safe);
}
