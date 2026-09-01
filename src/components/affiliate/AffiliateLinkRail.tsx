import type { AffiliateProduct } from "@/lib/types";
import type { MarketConfig } from "@/lib/market/config";
import type { PostChannel } from "@/lib/posts/types";

/** Hidden until shopping recommendations return after AdSense approval. */
export function AffiliateLinkRail(_props: {
  channel: PostChannel;
  keyword?: string;
  entityName?: string;
  products?: AffiliateProduct[];
  market?: MarketConfig;
}): null {
  return null;
}
