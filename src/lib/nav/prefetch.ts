import { entityHref } from "@/lib/slugs";

type Prefetchable = { slug: string; name?: string; type?: string };

/**
 * Warm Next.js RSC cache for heatmap / ranking rows during idle time so the
 * next tile click does not start a cold flight.
 */
export function scheduleEntityPrefetch(
  prefetch: (href: string) => void,
  items: Prefetchable[],
): () => void {
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    for (const item of items) {
      prefetch(entityHref(item));
    }
  };

  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(run, { timeout: 700 });
    return () => {
      cancelled = true;
      cancelIdleCallback(id);
    };
  }

  const timer = window.setTimeout(run, 0);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
