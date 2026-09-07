let navigatingUntil = 0;

/** Soft-nav is in flight — skip competing router.refresh / heatmap refetch. */
export function markNavigating(ms = 4000): void {
  navigatingUntil = Date.now() + ms;
}

export function isNavigating(): boolean {
  return Date.now() < navigatingUntil;
}
