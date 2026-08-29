import type { AffiliateProvider } from "@/lib/affiliate/types";
import type { MarketConfig } from "@/lib/market/config";

interface RailCopy {
  heading: string;
  intro: string;
}

/**
 * Section chrome around the storefront tiles. Program names come from the
 * providers themselves so adding a market means adding a language branch here,
 * not editing components.
 */
export function railCopy(
  market: MarketConfig,
  query: string,
  providers: AffiliateProvider[],
): RailCopy {
  const names = providers.map((provider) => provider.label).join(" · ");

  if (market.language === "ko") {
    return {
      heading: `${query} 제휴 최저가`,
      intro: `${names} 검색으로 같은 키워드의 판매 페이지를 엽니다. 가격은 제휴몰 기준입니다.`,
    };
  }

  return {
    heading: `Shop “${query}”`,
    intro: `${names} search opens the same keyword on the storefront. Prices are set by the retailer.`,
  };
}
