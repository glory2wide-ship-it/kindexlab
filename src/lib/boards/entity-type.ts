import { getBoard } from "@/lib/boards/registry";
import type { PostChannel } from "@/lib/posts/types";
import type { EntityType } from "@/lib/types";

/**
 * Board slug → primary live-tape entity type (briefing desks, chart overlays).
 * Entertainment/politics keep chart-native types; economy/culture/travel menus
 * each get a dedicated type so overlays never cross-contaminate sibling boards.
 */
const BOARD_ENTITY_TYPE: Record<string, EntityType> = {
  // Entertainment
  "realtime-music-chart": "music_chart",
  "kpop-fandom-power": "kpop",
  "trot-kayo-fandom-power": "kpop",
  "realtime-tv-ratings": "tv_rating",
  "variety-hot-minute": "tv_rating",
  "star-reputation-index": "celebrity",
  "game-esports-ranking": "pc_game",
  "boxoffice-expectation": "movie",
  "entertain-youtuber-ranking": "influencer",
  "realtime-webtoon-rank": "webtoon",

  // Politics
  "political-influencer-power": "political_influencer",
  "political-pundit-ranking": "political_pundit",
  "policy-controversy-index": "political_search",
  "governor-approval-index": "local_policy",
  "government-support-fund": "subsidy",
  "government-subsidy-search": "subsidy",
  "party-support-chart": "party_support",
  "politician-support-chart": "politician_support",

  // Economy menus
  "housing-subscription-hotspot": "housing",
  "rates-finance-products": "finance_product",
  "kospi-fomo-index": "stock_market",
  "overseas-stock-index": "overseas_stock",
  "commodities-fx-index": "commodities_fx",
  "inflation-sentiment-index": "inflation",
  "startup-franchise-index": "startup_franchise",
  "economy-issue-keywords": "economy_issue",

  // Culture menus
  "performance-ticket-ranking": "performance",
  "exhibition-popup-ranking": "exhibition",
  "bestseller-surge-index": "book",
  "health-info-ranking": "health_info",
  "recipe-ranking": "recipe",
  "car-review-ranking": "car_review",
  "culture-issue-keywords": "culture_issue",

  // Travel menus
  "domestic-travel-ranking": "travel_spot",
  "overseas-travel-ranking": "overseas_travel",
  "weekend-outing-ranking": "outing",
  "food-restaurant-ranking": "restaurant",
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

/** Split desk types for economy (visible menus + legacy bucket). */
export const ECONOMY_ENTITY_TYPES: EntityType[] = [
  "housing",
  "finance_product",
  "stock_market",
  "overseas_stock",
  "commodities_fx",
  "inflation",
  "startup_franchise",
  "economy_issue",
  "economy_board",
];

/** Split desk types for culture/living menus + legacy bucket. */
export const CULTURE_ENTITY_TYPES: EntityType[] = [
  "performance",
  "exhibition",
  "book",
  "health_info",
  "recipe",
  "car_review",
  "culture_issue",
  "culture_board",
];

/** Split desk types for travel/food menus. */
export const TRAVEL_ENTITY_TYPES: EntityType[] = [
  "travel_spot",
  "overseas_travel",
  "outing",
  "restaurant",
];

const BOARD_DESK_TYPE_SET = new Set<EntityType>([
  ...ECONOMY_ENTITY_TYPES,
  ...CULTURE_ENTITY_TYPES,
  ...TRAVEL_ENTITY_TYPES,
]);

export function entityTypeForBoardSlug(slug: string): EntityType | undefined {
  return BOARD_ENTITY_TYPE[slug];
}

/**
 * Menu label stamped on heatmap tiles — always the board shortTitle so
 * "메뉴 = 타일 출처" stays fixed even when live overlays replace scores.
 */
export function heatmapGroupForBoardSlug(slug: string): string | undefined {
  return getBoard(slug)?.shortTitle;
}

/** Channel for a board slug when registry lookup is available. */
export function channelForBoardSlug(slug: string): PostChannel | undefined {
  return getBoard(slug)?.channel;
}

/**
 * Live snapshot types that may fill this board's ranking (aliases included).
 * Empty → keep seed/template ranking (or board-slug-tagged live-chart rows).
 */
export function liveEntityTypesForBoard(slug: string): EntityType[] {
  if (GRANT_BOARDS_WITHOUT_LIVE_OVERLAY.has(slug)) return [];
  const primary = entityTypeForBoardSlug(slug);
  if (!primary) return [];
  if (primary === "pc_game") return ["pc_game", "console_game", "mobile_game"];
  if (primary === "tv_rating") return ["tv_rating", "tv_show"];
  if (primary === "political_influencer") {
    return ["political_influencer"];
  }
  return [primary];
}

/** True for economy/culture/travel desk entity types (incl. legacy buckets). */
export function isBoardDeskEntityType(type: EntityType): boolean {
  return BOARD_DESK_TYPE_SET.has(type);
}

/**
 * Resolve entity type for a board row when emitting tape / live-chart entities.
 * Falls back to legacy economy_board / culture_board buckets.
 */
export function entityTypeForBoardChannel(
  slug: string,
  channel: PostChannel,
): EntityType {
  return (
    entityTypeForBoardSlug(slug) ??
    (channel === "economy"
      ? "economy_board"
      : channel === "culture" || channel === "travel"
        ? "culture_board"
        : channel === "politics"
          ? "political_search"
          : "influencer")
  );
}
