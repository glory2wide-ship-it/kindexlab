import type { EntityType } from "@/lib/types";

/** Board slug → primary live-tape entity type (briefing desks, chart overlays). */
const BOARD_ENTITY_TYPE: Record<string, EntityType> = {
  "realtime-music-chart": "music_chart",
  "kpop-fandom-power": "kpop",
  "trot-kayo-fandom-power": "kpop",
  "realtime-tv-ratings": "tv_rating",
  "variety-hot-minute": "tv_rating",
  "star-reputation-index": "celebrity",
  "game-esports-ranking": "pc_game",
  "boxoffice-expectation": "movie",
  "entertain-youtuber-ranking": "influencer",
  "political-influencer-power": "political_influencer",
  "political-pundit-ranking": "political_pundit",
  "policy-controversy-index": "political_search",
  "governor-approval-index": "local_policy",
  "government-support-fund": "subsidy",
  "government-subsidy-search": "subsidy",
  "party-support-chart": "party_support",
  "politician-support-chart": "politician_support",
  "shortform-meme-velocity": "shorts",
  "realtime-webtoon-rank": "webtoon",
};

/**
 * Grant boards share the `subsidy` type with politics/economy programmes.
 * Never overlay the politics subsidy tape onto culture/travel/ent grant menus.
 */
const GRANT_BOARDS_WITHOUT_LIVE_OVERLAY = new Set([
  "culture-leisure-grant-ranking",
  "travel-government-grant-ranking",
  "entertainment-government-grant-ranking",
]);

export function entityTypeForBoardSlug(slug: string): EntityType | undefined {
  return BOARD_ENTITY_TYPE[slug];
}

/**
 * Live snapshot types that may fill this board's ranking (aliases included).
 * Empty → keep seed/template ranking.
 */
export function liveEntityTypesForBoard(slug: string): EntityType[] {
  if (GRANT_BOARDS_WITHOUT_LIVE_OVERLAY.has(slug)) return [];
  const primary = entityTypeForBoardSlug(slug);
  if (!primary) return [];
  if (primary === "pc_game") return ["pc_game", "console_game", "mobile_game"];
  if (primary === "tv_rating") return ["tv_rating", "tv_show"];
  if (primary === "political_influencer") {
    return ["political_influencer", "political_ratings"];
  }
  return [primary];
}
