import { entityHref } from "@/lib/slugs";

type Prefetchable = { slug: string; name?: string; type?: string };

/**
 * Hover/focus-only prefetch. Idle-prefetching every heatmap tile used to fire
 * dozens of `/ranking/[slug]` RSC renders at once; each cold serverless
 * instance parsed the full analysis cache and starved the click the user
 * actually made.
 */
export function scheduleEntityPrefetch(
  _prefetch: (href: string) => void,
  _items: Prefetchable[],
): () => void {
  return () => undefined;
}

export function hoverPrefetchHandlers(
  prefetch: (href: string) => void,
  href: string,
): {
  onPointerEnter: () => void;
  onFocus: () => void;
} {
  return {
    onPointerEnter: () => prefetch(href),
    onFocus: () => prefetch(href),
  };
}

export function entityPrefetchHref(item: Prefetchable): string {
  return entityHref(item);
}
