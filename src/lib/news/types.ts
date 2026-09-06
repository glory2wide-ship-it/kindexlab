import type { CountryCode, MarketConfig, NewsProviderId } from "@/lib/market/config";
import type { PublisherKind } from "@/lib/news/publishers";

export type NewsSourceId = NewsProviderId;

/**
 * A single retrieved article. Deliberately carries no numbers beyond the
 * publish timestamp: this feeds the editorial prompt, which forbids market copy.
 */
export interface NewsDoc {
  title: string;
  publisher?: string;
  link?: string;
  publishedAt?: string;
  snippet?: string;
  source: NewsSourceId;
  /** "trusted" outlets rank above "unknown"; "ugc" never reaches this list. */
  publisherKind: Exclude<PublisherKind, "ugc">;
}

export interface NewsRetrievalStats {
  fetched: number;
  kept: number;
  keptTrusted: number;
  droppedStale: number;
  droppedOffTopic: number;
  droppedMarketTape: number;
  droppedDuplicate: number;
  droppedUgc: number;
  droppedUntrusted: number;
}

export interface NewsRetrieval {
  keyword: string;
  /** Every name the query covered, including the keyword itself. */
  aliases: string[];
  country: CountryCode;
  /** Providers that actually ran, after the configured-credentials filter. */
  providers: NewsProviderId[];
  fetchedAt: string;
  docs: NewsDoc[];
  stats: NewsRetrievalStats;
  errors: { source: NewsSourceId; message: string }[];
}

export interface NewsRetrieveOptions {
  /** Overrides the environment market; mainly for inspection and tests. */
  market?: MarketConfig;
  /** Max docs returned after filtering. */
  limit?: number;
  /** Articles older than this are dropped. */
  lookbackHours?: number;
  /** Defaults to true: keep only recognised outlets. Set false to inspect recall. */
  trustedOnly?: boolean;
  /** Overrides the resolved alias set; mainly for inspection and tests. */
  aliases?: string[];
  /** Ranking boards need price/rank headlines; entity columns still drop them. */
  allowMarketTape?: boolean;
  /** Keep Google News RSS hits even when the headline omits the exact query token. */
  skipAliasFilter?: boolean;
}
