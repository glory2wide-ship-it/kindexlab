/**
 * Heatmap tiles with the same `id` (or slug) collapse to one React key and
 * one clipPath. The extra layout box then paints as an empty grey cell and
 * the rank sequence skips (e.g. #11 → #13).
 */
export function uniqueHeatmapTiles<T extends { id: string; slug?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item) continue;
    const keys = [item.id, item.slug ?? ""].map((value) => value.trim()).filter(Boolean);
    if (keys.some((key) => seen.has(key))) continue;
    for (const key of keys) seen.add(key);
    out.push(item);
  }
  return out;
}
