import type { EntityType } from "@/lib/types";

/** Board slug → live-tape entity type (briefing desks, chart overlays). */
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
  "culture-leisure-grant-ranking": "subsidy",
  "travel-government-grant-ranking": "subsidy",
  "entertainment-government-grant-ranking": "subsidy",
  "party-support-chart": "party_support",
  "politician-support-chart": "politician_support",
  "shortform-meme-velocity": "shorts",
  "realtime-webtoon-rank": "webtoon",
};

export function entityTypeForBoardSlug(slug: string): EntityType | undefined {
  return BOARD_ENTITY_TYPE[slug];
}
