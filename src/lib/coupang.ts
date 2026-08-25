const PARTNER_ID = process.env.NEXT_PUBLIC_COUPANG_PARTNER_ID ?? "000000";

/**
 * Builds a Coupang Partners deep link.
 * Replace with official short links from partners.coupang.com when going live.
 */
export function coupangSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://www.coupang.com/np/search?q=${encoded}&chan=kindexlab&subid=${PARTNER_ID}`;
}
