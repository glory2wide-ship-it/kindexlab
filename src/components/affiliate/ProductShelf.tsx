import type { AffiliateProvider } from "@/lib/affiliate/types";
import type { MarketConfig } from "@/lib/market/config";
import type { AffiliateProduct } from "@/lib/types";

/** Hidden until shopping recommendations return after AdSense approval. */
export function ProductShelf(_props: {
  products: AffiliateProduct[];
  entityName: string;
  market?: MarketConfig;
  provider?: AffiliateProvider;
}): null {
  return null;
}
