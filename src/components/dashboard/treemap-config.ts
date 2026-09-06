/**
 * Tile cap, split out from `TreemapView` so callers can size their lists
 * without importing the view — and with it `d3-hierarchy` — into the entry
 * bundle. The view is loaded as its own chunk.
 */
export const TREEMAP_MAX_ITEMS = 20;
