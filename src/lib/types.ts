import type { PostChannel } from "@/lib/posts/types";

export type EntityType =
  | "kpop"
  | "celebrity"
  | "tv_show"
  | "influencer"
  | "music_chart"
  | "tv_rating"
  | "webtoon"
  | "shorts"
  | "mobile_game"
  | "pc_game"
  | "console_game"
  | "headline_news"
  | "party_support"
  | "politician_support"
  | "political_pundit"
  | "political_influencer"
  | "political_ratings"
  | "political_search"
  | "local_policy"
  | "subsidy"
  | "economy_board"
  | "culture_board";

export type CategoryId = "all" | EntityType;

export type ViewMode = "treemap" | "list";

export type Timeframe = "1m" | "5m" | "10m" | "30m" | "60m" | "120m" | "1d" | "1w" | "1mo";

export type MarketStatus = "open" | "closed";

export interface AffiliateProduct {
  id: string;
  name: string;
  brand: string;
  priceKrw: number;
  originalPriceKrw?: number;
  discountRate?: number;
  reason: string;
  searchQuery: string;
  category: string;
  /**
   * Native price for non-KRW catalogs. When absent, priceKrw is only valid in
   * the KR market; other storefronts render the card without a price.
   */
  price?: number;
  currency?: string;
}

export interface SeriesPoint {
  t: string;
  v: number;
}

/** Per-timeframe snapshot used by charts and the public /api/trends payload. */
export interface TimeframeMetric {
  buzzScore: number;
  changeRate: number;
  volume: number;
}

export type TimeframeMetrics = Record<Timeframe, TimeframeMetric>;

export interface RankingEntity {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  type: EntityType;
  rank: number;
  previousRank: number;
  buzzScore: number;
  openScore: number;
  fluctuationRate: number;
  volume: number;
  sparkline: number[];
  history: SeriesPoint[];
  tags: string[];
  summary: string;
  /**
   * Detail-page copy. Optional because board tiles never render it: the desk
   * pages ship hundreds of entities and the analysis paragraph is dead weight
   * in that payload. `/ranking/[slug]` reads the entity from the store, where
   * the field is always present.
   */
  analysis?: string;
  /** Detail-page affiliate shelf. Omitted from tile payloads — see `analysis`. */
  products?: AffiliateProduct[];
  metrics?: TimeframeMetrics;
  imageUrl?: string;
  /** When set, heatmap/list tiles open this path instead of `/ranking/[slug]`. */
  href?: string;
  /** Treemap sector label. When set, 종합 히트맵 groups by board menu title. */
  heatmapGroup?: string;
  /** 게임 e스포츠 platform tag, e.g. PC, 모바일, 콘솔, PC/콘솔. */
  platform?: string;
  /** Original article publish time (ISO). Used by headline velocity ranking. */
  publishedAt?: string;
  /** 시/도 slug. 음식/맛집 지역 탭의 엄격 필터에 쓴다. */
  region?: string;
  /**
   * Desk this row was drawn from, set only when channels are merged into one
   * board. Carried explicitly rather than derived from `type`, because the
   * board→type map is many-to-one: 문화 grant rows and 정부 지원금 rows both land
   * on `subsidy`, so deriving the label would file culture tiles under 정치.
   */
  sourceChannel?: PostChannel;
}

/** Public API DTO. Mock today; swap the provider to a scraper later. */
export interface TrendEntity {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  category: EntityType;
  rank: number;
  previousRank: number;
  buzzScore: number;
  fluctuationPct: number;
  volume: number;
  metrics: TimeframeMetrics;
  sparkline: number[];
  tags: string[];
  summary: string;
  analysis: string;
  products: AffiliateProduct[];
}

export interface TrendsPayload {
  source: "mock" | "live";
  updatedAt: string;
  status: MarketStatus;
  timeframe: Timeframe;
  indices: MarketIndex[];
  items: TrendEntity[];
}

export interface MarketIndex {
  id: string;
  label: string;
  value: number;
  changeRate: number;
  changePoints?: number;
  previousValue?: number;
  note: string;
  href?: string;
}

export interface BriefingCoverImage {
  src: string;
  alt: string;
  photographer?: string;
  source?: "live" | "unsplash" | "fallback";
}

export interface DailyBriefing {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  wordCount: number;
  coverImage?: BriefingCoverImage;
  sections: BriefingSection[];
}

export type BriefingKind = "main" | "deep-dive";

export interface BriefingTable {
  caption: string;
  headers: string[];
  rows: string[][];
  markdown?: string;
}

export interface BriefingFaq {
  question: string;
  answer: string;
}

export interface BriefingLink {
  href: string;
  label: string;
  rel?: string;
}

export interface BriefingArticle extends DailyBriefing {
  kind: BriefingKind;
  category: CategoryId;
  channel?: "entertainment" | "economy" | "politics" | "culture";
  deskId?: string;
  deskLabel?: string;
  editionDate: string;
  relatedEntitySlugs: string[];
  focusKeyword?: string;
  supportKeyword?: string;
  table?: BriefingTable;
  faq?: BriefingFaq[];
  externalLink?: BriefingLink;
  internalLink?: BriefingLink;
}

export interface BriefingSection {
  heading?: string;
  headingLevel?: 2 | 3;
  paragraphs: string[];
  kind?: "tape" | "briefing";
}

export interface RankingsPayload {
  updatedAt: string;
  status: MarketStatus;
  indices: MarketIndex[];
  items: RankingEntity[];
}

export interface TimeframeOption {
  id: Timeframe;
  label: string;
  group: "분봉" | "일봉" | "주봉" | "월봉";
}
