import type { MarketConfig, NewsProviderId } from "@/lib/market/config";
import { googleNewsProvider } from "@/lib/news/providers/google-news";
import { naverNewsProvider } from "@/lib/news/providers/naver";
import { serperProvider } from "@/lib/news/providers/serper";
import type { NewsProvider } from "@/lib/news/providers/types";

const REGISTRY: Record<NewsProviderId, NewsProvider> = {
  "google-news": googleNewsProvider,
  "naver-news": naverNewsProvider,
  serper: serperProvider,
};

export function getNewsProvider(id: NewsProviderId): NewsProvider {
  return REGISTRY[id];
}

/**
 * Providers the market declares, minus those missing credentials. Switching
 * NEXT_PUBLIC_MARKET_COUNTRY from KR to US swaps Naver out for Serper without
 * touching retrieval code.
 */
export function resolveNewsProviders(market: MarketConfig): NewsProvider[] {
  return market.newsProviders
    .map((id) => REGISTRY[id])
    .filter((provider): provider is NewsProvider => Boolean(provider) && provider.isConfigured(market));
}

export type { NewsProvider, NewsSearchContext, RawNewsDoc } from "@/lib/news/providers/types";
