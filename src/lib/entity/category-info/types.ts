/**
 * Excel「카테고리 정리 킨덱스 0916」— heatmap detail channel packs.
 * Discriminated by `kind` for conditional UI rendering.
 */

export type CategoryInfoCategory =
  | "entertainment"
  | "politics"
  | "economy"
  | "culture"
  | "travel";

/** Excel [채널 명] → stable id used in code. */
export type CategoryInfoChannel =
  | "kpop"
  | "trot"
  | "tv_ratings"
  | "music"
  | "star"
  | "movie"
  | "youtuber"
  | "webtoon"
  | "game"
  | "gov_subsidy"
  | "party_support"
  | "politician_support"
  | "local_policy"
  | "politics_youtube"
  | "political_pundit"
  | "issue_keyword"
  | "housing"
  | "finance"
  | "stock"
  | "overseas_stock"
  | "commodities_fx"
  | "inflation"
  | "startup"
  | "performance"
  | "exhibition"
  | "book"
  | "health"
  | "recipe"
  | "car"
  | "travel_grant"
  | "domestic_travel"
  | "overseas_travel"
  | "weekend_outing"
  | "food"
  | "generic";

export type CategoryInfoLink = {
  title: string;
  href: string;
  source?: string;
};

export type CategoryInfoRow = {
  label: string;
  value: string;
  href?: string;
  emphasize?: boolean;
};

export type CategoryInfoChipGroup = {
  label: string;
  items: string[];
};

export type CategoryInfoSparkline = {
  title: string;
  /** Display unit hint, e.g. "만원". */
  unit?: string;
  points: Array<{ label: string; value: number }>;
};

export type CategoryInfoBase = {
  category: CategoryInfoCategory;
  channel: CategoryInfoChannel;
  channelLabel: string;
  entityName: string;
  entitySlug: string;
  updatedAt: string;
  /** True when curated/API fields are thin and news fallback is primary. */
  sparse: boolean;
  statusMessage?: string;
  rows: CategoryInfoRow[];
  chips: CategoryInfoChipGroup[];
  synopsis?: string;
  notice?: string;
  links: CategoryInfoLink[];
  /** Optional mini trend (e.g. housing monthly mid prices). */
  sparkline?: CategoryInfoSparkline;
};

export type CategoryInfoPayload = CategoryInfoBase;
