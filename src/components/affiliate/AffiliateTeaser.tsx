import { coupangSearchUrl } from "@/lib/coupang";
import { formatKrw } from "@/lib/format";
import { rankingPath } from "@/lib/slugs";
import type { AffiliateProduct } from "@/lib/types";

export function AffiliateTeaser({
  products,
  entityName,
  entitySlug,
  href,
  compact = false,
}: {
  products: AffiliateProduct[];
  entityName: string;
  entitySlug?: string;
  href?: string;
  compact?: boolean;
}) {
  const featured = products[0];
  if (!featured) return null;
  const detailHref = href ?? (entitySlug ? rankingPath(entitySlug, "products") : coupangSearchUrl(featured.searchQuery));

  if (compact) {
    return (
      <a
        href={detailHref}
        data-monetization="affiliate"
        className="pointer-events-auto mt-2 flex items-center justify-between gap-2 rounded-lg border border-line bg-board/80 px-2 py-1.5 text-[11px] leading-4 text-ink no-underline"
      >
        <span className="min-w-0 truncate text-muted">
          관련 아이템 · {featured.brand} {featured.name}
        </span>
        <span className="shrink-0 font-medium text-accent">보기</span>
      </a>
    );
  }

  return (
    <a
      href={href ?? coupangSearchUrl(featured.searchQuery)}
      target="_blank"
      rel="sponsored noopener noreferrer"
      data-monetization="affiliate"
      className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-board px-4 py-3 no-underline transition-colors hover:border-accent/50"
    >
      <span>
        <span className="block text-[11px] uppercase tracking-wider text-muted">
          Coupang Partners
        </span>
        <span className="mt-0.5 block text-sm">
          {entityName} · {featured.name}
        </span>
      </span>
      <span className="shrink-0 font-mono text-sm text-accent">{formatKrw(featured.priceKrw)}</span>
    </a>
  );
}
