/**
 * Toss Shopping search URL for affiliate wrappers.
 * Replace with official partner deep links when a Toss Shopping program ID is issued.
 */
export function tossShoppingUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://shopping.toss.im/search?q=${encoded}`;
}
