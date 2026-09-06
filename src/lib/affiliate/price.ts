import { formatMoney, type MarketConfig } from "@/lib/market/config";
import type { AffiliateProduct } from "@/lib/types";

/**
 * Resolves a price the storefront can honestly show. Catalog rows without a
 * native `price` carry KRW only, so they are priceless outside the KR market
 * rather than being converted at a rate we do not have.
 */
export function resolvePrice(
  amount: number | undefined,
  currency: string | undefined,
  market: MarketConfig,
): string | null {
  if (amount === undefined) return null;
  const resolved = currency ?? "KRW";
  if (resolved !== market.currency) return null;
  return formatMoney(amount, market);
}

export function productPrice(product: AffiliateProduct, market: MarketConfig): string | null {
  return resolvePrice(product.price ?? product.priceKrw, product.currency, market);
}

export function productListPrice(product: AffiliateProduct, market: MarketConfig): string | null {
  if (product.price !== undefined) return null;
  return resolvePrice(product.originalPriceKrw, product.currency, market);
}
