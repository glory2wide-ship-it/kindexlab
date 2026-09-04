import { POLITICS_HEATMAP_BOARD_NAV, TRAVEL_HEATMAP_BOARD_NAV } from "@/lib/constants/nav";
import type { BoardDefinition } from "@/lib/boards/types";
import type { PostChannel } from "@/lib/posts/types";

/** Default heatmap tiles for every channel unless a board override applies. */
export const DEFAULT_CHANNEL_HEATMAP_TILES = 15;
export const ENTERTAINMENT_HEATMAP_TILES = DEFAULT_CHANNEL_HEATMAP_TILES;
export const ECONOMY_HEATMAP_TILES = DEFAULT_CHANNEL_HEATMAP_TILES;
export const CULTURE_HEATMAP_TILES = DEFAULT_CHANNEL_HEATMAP_TILES;
export const TRAVEL_HEATMAP_TILES = DEFAULT_CHANNEL_HEATMAP_TILES;
export const POLITICS_HEATMAP_TILES = DEFAULT_CHANNEL_HEATMAP_TILES;
export const DEFAULT_HEATMAP_TILES = 15;
/** 정당 지지도 랭킹 board tile cap. */
export const PARTY_SUPPORT_HEATMAP_TILES =
  POLITICS_HEATMAP_BOARD_NAV["party-support-chart"].heatmapLimit;
/** 정치인 지지도 랭킹 board tile cap. */
export const POLITICIAN_SUPPORT_HEATMAP_TILES =
  POLITICS_HEATMAP_BOARD_NAV["politician-support-chart"].heatmapLimit;

export function isTravelRegionalHeatmapBoard(slug: string): slug is keyof typeof TRAVEL_HEATMAP_BOARD_NAV {
  return slug === "domestic-travel-ranking" || slug === "weekend-outing-ranking";
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
    channel === "entertainment"
  );
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
  return `#${String(safe).padStart(2, "0")}`;
}
