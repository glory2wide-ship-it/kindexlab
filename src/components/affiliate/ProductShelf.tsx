import { coupangSearchUrl } from "@/lib/coupang";
import { formatKrw } from "@/lib/format";
import type { AffiliateProduct } from "@/lib/types";

export function ProductShelf({
  products,
  entityName,
}: {
  products: AffiliateProduct[];
  entityName: string;
}) {
  if (products.length === 0) return null;

  return (
    <section
      id="products"
      data-monetization="affiliate"
      className="rounded-2xl border border-line bg-panel p-5 md:p-7"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
        Coupang Partners
      </p>
      <h2 className="mt-2 text-xl font-semibold">
        {entityName} 관련 아이템 최저가 비교
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        방송·화보에서 언급되거나 착용된 스타일과 비슷한 상품을 큐레이션했습니다. 가격은
        제휴몰 기준으로 변동될 수 있습니다.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <li key={product.id}>
            <a
              href={coupangSearchUrl(product.searchQuery)}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="block h-full rounded-xl border border-line bg-board p-4 transition-colors hover:border-accent/50"
            >
              <span className="grid h-28 place-items-center rounded-lg bg-gradient-to-br from-accent/20 via-panel to-down/10 font-mono text-xs text-muted">
                {product.category}
              </span>
              <p className="mt-3 text-xs text-muted">{product.brand}</p>
              <h3 className="mt-1 font-medium">{product.name}</h3>
              <p className="mt-2 font-mono text-lg font-semibold">
                {formatKrw(product.priceKrw)}
                {product.originalPriceKrw ? (
                  <span className="ml-2 text-xs text-muted line-through">
                    {formatKrw(product.originalPriceKrw)}
                  </span>
                ) : null}
                {product.discountRate ? (
                  <span className="ml-2 text-xs text-up">{product.discountRate}%</span>
                ) : null}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted">{product.reason}</p>
              <span className="mt-3 inline-flex text-xs font-medium text-accent">
                쿠팡에서 최저가 보기 →
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
