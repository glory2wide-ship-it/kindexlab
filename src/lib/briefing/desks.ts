import { TYPE_ORDER } from "@/lib/categories";
import { entityTypeForBoardSlug } from "@/lib/boards/entity-type";
import { menuBoardsForChannel } from "@/lib/boards/registry";
import { CHANNEL_ENTITY_TYPES, getPostChannel } from "@/lib/posts/channels";
import type { CategoryId, EntityType } from "@/lib/types";
import type { PostChannel } from "@/lib/posts/types";

export interface ChannelBriefingDesk {
  id: string;
  label: string;
  category: CategoryId;
  indexId?: string;
}

/**
 * Legacy entertainment deep-dive deskIds (entity types) → current board slugs.
 * Lets previously generated articles still bind to the synced board desks.
 */
export const ENTERTAINMENT_LEGACY_DESK_TO_BOARD: Record<string, string> = {
  kpop: "kpop-fandom-power",
  celebrity: "star-reputation-index",
  tv_show: "realtime-tv-ratings",
  influencer: "entertain-youtuber-ranking",
  music_chart: "realtime-music-chart",
  tv_rating: "realtime-tv-ratings",
  movie: "boxoffice-expectation",
  webtoon: "realtime-webtoon-rank",
  mobile_game: "game-esports-ranking",
  pc_game: "game-esports-ranking",
  console_game: "game-esports-ranking",
};

/**
 * Legacy politics deep-dive deskIds (pol-*) → ranking-board slugs.
 * Lower menu now mirrors the rail 1:1; this map keeps older articles bindable.
 */
export const POLITICS_LEGACY_DESK_TO_BOARD: Record<string, string> = {
  "pol-headline": "headline-news-ranking",
  "pol-approval": "politician-support-chart",
  "pol-party": "party-support-chart",
  "pol-politician": "politician-support-chart",
  "pol-pundit": "political-pundit-ranking",
  "pol-influencer": "political-influencer-power",
  "pol-ratings": "political-influencer-power",
  "pol-search": "policy-controversy-index",
  "pol-policy": "governor-approval-index",
  "pol-subsidy": "government-support-fund",
};

function desksFromTypes(types: EntityType[]): ChannelBriefingDesk[] {
  return types.map((type) => ({
    id: type,
    label: type,
    category: type,
    indexId: type,
  }));
}

function defaultCategoryForChannel(channel: PostChannel): CategoryId {
  if (channel === "economy") return "economy_board";
  if (channel === "culture" || channel === "travel") return "culture_board";
  if (channel === "politics") return "political_search";
  return "influencer";
}

/** Resolve a deep-dive article to the desk id used in the synced UI. */
export function resolveBriefingDeskId(deskId: string | undefined, channel: PostChannel): string | undefined {
  if (!deskId) return undefined;
  if (channel === "entertainment") {
    return ENTERTAINMENT_LEGACY_DESK_TO_BOARD[deskId] ?? deskId;
  }
  if (channel === "politics") {
    return POLITICS_LEGACY_DESK_TO_BOARD[deskId] ?? deskId;
  }
  return deskId;
}

/**
 * Lower-menu deep-dive desks — always mirror the ranking-board rail
 * (`menuBoardsForChannel`) so tabs and 심층 분석 cards stay 1:1.
 */
export function desksForChannel(channel: PostChannel): ChannelBriefingDesk[] {
  const boards = menuBoardsForChannel(channel);
  if (boards.length) {
    const fallback = defaultCategoryForChannel(channel);
    return boards.map((board) => ({
      id: board.slug,
      label: board.shortTitle,
      category: (entityTypeForBoardSlug(board.slug) ?? fallback) as CategoryId,
      indexId: board.slug,
    }));
  }
  return desksFromTypes(CHANNEL_ENTITY_TYPES[channel]);
}

export function channelMainLabel(channel: PostChannel): string {
  return `${getPostChannel(channel).label} 종합 브리핑`;
}

export function channelDeskTypes(channel: PostChannel): EntityType[] {
  const types = desksForChannel(channel)
    .map((desk) => desk.category)
    .filter((id): id is EntityType => id !== "all");
  return [...new Set(types)];
}

export function isPresidentialDesk(deskId?: string): boolean {
  return deskId === "pol-approval" || deskId === "politician-support-chart";
}

/** @deprecated TYPE_ORDER desks — kept for scripts that still reference entertainment entity desks. */
export function entertainmentLegacyTypeDesks(): ChannelBriefingDesk[] {
  return TYPE_ORDER.map((type) => ({
    id: type,
    label: type,
    category: type,
    indexId: type,
  }));
}
