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

/** Always stay on the internal ranking detail page. External hrefs are ignored. */
export function entityHref(item: { slug: string; name?: string; href?: string }, hash?: string): string {
  const path = rankingPath(item.slug);
  const query = item.name?.trim() ? `?name=${encodeURIComponent(item.name.trim())}` : "";
  const withQuery = `${path}${query}`;
  return hash ? `${withQuery}#${hash}` : withQuery;
}

export function rankingUrl(origin: string, slug: string): string {
  return `${origin}${rankingPath(slug)}`;
}

export function slugsMatch(stored: string, incoming: string): boolean {
  return decodeRouteSlug(stored) === decodeRouteSlug(incoming);
}
