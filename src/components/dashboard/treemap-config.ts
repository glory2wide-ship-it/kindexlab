/**
 * Tile cap, split out from `TreemapView` so callers can size their lists
 * without importing the view — and with it the layout module — into the entry
 * bundle. The view is loaded as its own chunk.
 */
export const TREEMAP_MAX_ITEMS = 20;

/** Mobile-only denser/readable heatmap. Desktop keeps `TREEMAP_MAX_ITEMS`. */
export const MOBILE_TREEMAP_MAX_ITEMS = 15;

/** List / 전광판 rows — desktop. */
export const LIST_MAX_ITEMS = 30;

/** List / 전광판 rows — mobile. */
export const MOBILE_LIST_MAX_ITEMS = 25;

/**
 * Shared frame for treemap + skeletons.
 * Mobile: portrait ~3:4 with a height cap. Desktop: fixed 640px (unchanged).
 */
export const TREEMAP_FRAME_CLASS =
  "relative w-full min-h-0 overflow-hidden bg-line aspect-[3/4] max-h-[620px] md:aspect-auto md:h-[640px] md:max-h-none";
