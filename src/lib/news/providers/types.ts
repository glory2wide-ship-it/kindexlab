import type { MarketConfig, NewsProviderId } from "@/lib/market/config";
import type { NewsDoc } from "@/lib/news/types";

/** Provider output, before the publisher registry assigns a trust tier. */
export type RawNewsDoc = Omit<NewsDoc, "publisherKind">;

export interface NewsSearchContext {
  market: MarketConfig;
  /** Upper bound on rows a provider should request from its upstream. */
  limit: number;
}

export interface NewsProvider {
  id: NewsProviderId;
  /**
   * False when required credentials are missing. Unconfigured providers are
   * skipped silently so a market keeps working on its keyless sources.
   */
  isConfigured(market: MarketConfig): boolean;
  search(keyword: string, context: NewsSearchContext): Promise<RawNewsDoc[]>;
}
