import { productPrice } from "@/lib/affiliate/price";
import type { AffiliateProvider } from "@/lib/affiliate/types";

const ASSOCIATE_TAG = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG ?? "";

export const amazonProvider: AffiliateProvider = {
  id: "amazon",
  label: "Amazon Associates",
  isConfigured: (market) => market.country !== "KR",
  searchUrl(query, market) {
    const params = new URLSearchParams({ k: query });
    if (ASSOCIATE_TAG) params.set("tag", ASSOCIATE_TAG);
    return `https://${market.amazonHost}/s?${params.toString()}`;
  },
  copy: {
    shelfHeading: (entityName) => `Shop ${entityName} picks`,
    shelfIntro:
      "A curated set of items in the same style as those featured in recent coverage. Prices are set by the storefront and may change.",
    cta: "View on Amazon →",
    railCta: (query) => `Search Amazon for “${query}”`,
    disclosure: "As an Amazon Associate we earn from qualifying purchases.",
  },
  formatPrice: (product, market) => productPrice(product, market) ?? "",
};
