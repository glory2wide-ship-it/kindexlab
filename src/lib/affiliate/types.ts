import type { AffiliateProviderId, MarketConfig } from "@/lib/market/config";
import type { AffiliateProduct } from "@/lib/types";

export interface AffiliateProvider {
  id: AffiliateProviderId;
  /** Program name shown as the shelf kicker, e.g. "Coupang Partners". */
  label: string;
  /** False when the program has no id configured for this market. */
  isConfigured(market: MarketConfig): boolean;
  /** Storefront search deep link carrying the affiliate tag. */
  searchUrl(query: string, market: MarketConfig): string;
  /** Localised copy. Components render these instead of hardcoding Korean. */
  copy: {
    /** Heading built from the entity name, e.g. "아이유 관련 아이템 최저가 비교". */
    shelfHeading(entityName: string): string;
    shelfIntro: string;
    /** Card CTA, e.g. "쿠팡에서 최저가 보기 →". */
    cta: string;
    /** Secondary rail CTA built from the search term. */
    railCta(query: string): string;
    /** Required program disclosure text. */
    disclosure: string;
  };
  /** Renders a product price in the storefront's currency. */
  formatPrice(product: AffiliateProduct, market: MarketConfig): string;
}
