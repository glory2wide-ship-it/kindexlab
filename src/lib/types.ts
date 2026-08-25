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
  | "console_game";

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
  analysis: string;
  products: AffiliateProduct[];
  metrics?: TimeframeMetrics;
  imageUrl?: string;
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
  note: string;
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

export interface BriefingArticle extends DailyBriefing {
  kind: BriefingKind;
  category: CategoryId;
  editionDate: string;
  relatedEntitySlugs: string[];
}

export interface BriefingSection {
  heading?: string;
  headingLevel?: 2 | 3;
  paragraphs: string[];
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
