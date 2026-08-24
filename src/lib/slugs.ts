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

export function rankingUrl(origin: string, slug: string): string {
  return `${origin}${rankingPath(slug)}`;
}

export function slugsMatch(stored: string, incoming: string): boolean {
  return decodeRouteSlug(stored) === decodeRouteSlug(incoming);
}
