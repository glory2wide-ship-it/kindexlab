import type { BoardDefinition } from "@/lib/boards/types";
import type { PostChannel } from "@/lib/posts/types";

/** Heatmap tiles on a single entertainment board (requested range 25–30). */
export const ENTERTAINMENT_HEATMAP_TILES = 28;
export const ECONOMY_HEATMAP_TILES = 25;
export const CULTURE_HEATMAP_TILES = 25;
export const DEFAULT_HEATMAP_TILES = 10;
/** How many names each entertainment board contributes to 종합. */
export const ENTERTAINMENT_COMPOSITE_PER_BOARD = 4;
export const ECONOMY_COMPOSITE_PER_BOARD = 4;
export const CULTURE_COMPOSITE_PER_BOARD = 4;
export const DEFAULT_COMPOSITE_PER_BOARD = 2;
export const ENTERTAINMENT_SEGMENT_SIZE = 12;
export const ECONOMY_SEGMENT_SIZE = 12;
export const CULTURE_SEGMENT_SIZE = 25;
export const DEFAULT_SEGMENT_SIZE = 5;

export function channelUsesBoardHeatmap(channel: PostChannel): boolean {
  return channel === "economy" || channel === "culture" || channel === "entertainment";
}

export function rankLimitForChannel(channel: PostChannel): number {
  if (channel === "entertainment") return ENTERTAINMENT_HEATMAP_TILES;
  if (channel === "economy") return ECONOMY_HEATMAP_TILES;
  if (channel === "culture") return CULTURE_HEATMAP_TILES;
  return DEFAULT_HEATMAP_TILES;
}

export function rankLimitForBoard(board: Pick<BoardDefinition, "channel">): number {
  return rankLimitForChannel(board.channel);
}

export function segmentLimitForBoard(board: Pick<BoardDefinition, "channel">): number {
  if (board.channel === "entertainment") return ENTERTAINMENT_SEGMENT_SIZE;
  if (board.channel === "economy") return ECONOMY_SEGMENT_SIZE;
  if (board.channel === "culture") return CULTURE_SEGMENT_SIZE;
  return DEFAULT_SEGMENT_SIZE;
}

export function compositePerBoard(channel: PostChannel): number {
  if (channel === "entertainment") return ENTERTAINMENT_COMPOSITE_PER_BOARD;
  if (channel === "economy") return ECONOMY_COMPOSITE_PER_BOARD;
  if (channel === "culture") return CULTURE_COMPOSITE_PER_BOARD;
  return DEFAULT_COMPOSITE_PER_BOARD;
}

export function formatHeatmapRank(rank: number): string {
  const safe = Number.isFinite(rank) && rank > 0 ? Math.round(rank) : 1;
  return `#${String(safe).padStart(2, "0")}`;
}
