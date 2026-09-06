import { amazonProvider } from "@/lib/affiliate/providers/amazon";
import { coupangProvider } from "@/lib/affiliate/providers/coupang";
import { tossProvider } from "@/lib/affiliate/providers/toss";
import type { AffiliateProvider } from "@/lib/affiliate/types";
import { activeMarket, type AffiliateProviderId, type MarketConfig } from "@/lib/market/config";

const REGISTRY: Record<AffiliateProviderId, AffiliateProvider> = {
  coupang: coupangProvider,
  toss: tossProvider,
  amazon: amazonProvider,
};

export function getAffiliateProvider(id: AffiliateProviderId): AffiliateProvider {
  return REGISTRY[id];
}

/** Every program the market declares, minus those without a configured id. */
export function resolveAffiliateProviders(market: MarketConfig = activeMarket()): AffiliateProvider[] {
  return market.affiliateProviders
    .map((id) => REGISTRY[id])
    .filter((provider): provider is AffiliateProvider => Boolean(provider) && provider.isConfigured(market));
}

/**
 * The program that owns the product shelf. Falls back to the market's first
 * declared program so a missing id degrades to plain links rather than a blank
 * section.
 */
export function primaryAffiliateProvider(
  market: MarketConfig = activeMarket(),
): AffiliateProvider {
  const [configured] = resolveAffiliateProviders(market);
  if (configured) return configured;
  const [declared] = market.affiliateProviders;
  return declared ? REGISTRY[declared] : coupangProvider;
}

export type { AffiliateProvider } from "@/lib/affiliate/types";
export { productPrice, productListPrice } from "@/lib/affiliate/price";
