/** Decode a dynamic-route slug that Next or the browser may have percent-encoded. */
export function decodeRouteSlug(slug: string): string {
  let current = slug;
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

export function rankingPath(slug: string, hash?: string): string {
  const path = `/ranking/${encodeURIComponent(decodeRouteSlug(slug))}`;
  return hash ? `${path}#${hash}` : path;
}

export function politicsDetailPath(slug: string, hash?: string): string {
  const path = `/politics/${encodeURIComponent(decodeRouteSlug(slug))}`;
  return hash ? `${path}#${hash}` : path;
}

/**
 * Collapse legacy bracket tails (`food-…--[서울]-을지로`) onto the live slugify
 * form (`food-…--서울-을지로`) so sitemap / feed advertise one URL per subject.
 * Matches `boardRowSlug` / heatmap `slugify` (strip `[` `]` glyphs, keep region text).
 */
export function canonicalEntityPathSlug(slug: string, displayName?: string): string {
  const decoded = decodeRouteSlug(slug);
  const sep = decoded.indexOf("--");
  if (sep <= 0) return decoded.replace(/[\[\]]/g, "");
  const board = decoded.slice(0, sep);
  const raw = (displayName?.trim() || decoded.slice(sep + 2).replace(/-/g, " ")).trim();
  const tail = raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-]/g, "")
    .slice(0, 48);
  return `${board}--${tail || "item"}`;
}

/**
 * Internal entity links stay on the clean ranking/politics path.
 * Do not append `?name=` — that creates GSC “alternate page with proper
 * canonical” duplicates while the meta canonical already omits the query.
 */
export function entityHref(
  item: { slug: string; name?: string; href?: string; type?: string },
  hash?: string,
): string {
  const isPoliticsSupport =
    item.type === "party_support" || item.type === "politician_support";
  const path = isPoliticsSupport ? politicsDetailPath(item.slug) : rankingPath(item.slug);
  return hash ? `${path}#${hash}` : path;
}

export function rankingUrl(origin: string, slug: string): string {
  return `${origin}${rankingPath(slug)}`;
}

export function slugsMatch(stored: string, incoming: string): boolean {
  return decodeRouteSlug(stored) === decodeRouteSlug(incoming);
}
