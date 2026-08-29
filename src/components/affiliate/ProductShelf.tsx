import { primaryAffiliateProvider, productListPrice, productPrice } from "@/lib/affiliate";
import type { AffiliateProvider } from "@/lib/affiliate/types";
import { activeMarket, type MarketConfig } from "@/lib/market/config";
import type { AffiliateProduct } from "@/lib/types";

export function ProductShelf({
  products,
  entityName,
  market = activeMarket(),
  provider,
}: {
  products: AffiliateProduct[];
  entityName: string;
  market?: MarketConfig;
  provider?: AffiliateProvider;
}) {
  if (!products?.length) return null;

  const storefront = provider ?? primaryAffiliateProvider(market);

  return (
    <section
      id="products"
      data-monetization="affiliate"
      data-affiliate-provider={storefront.id}
      className="rounded-2xl border border-line bg-panel p-5 md:p-7"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
        {storefront.label}
      </p>
      <h2 className="mt-2 text-xl font-semibold">{storefront.copy.shelfHeading(entityName)}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{storefront.copy.shelfIntro}</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const price = productPrice(product, market);
          const listPrice = productListPrice(product, market);

          return (
            <li key={product.id}>
              <a
                href={storefront.searchUrl(product.searchQuery, market)}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="block h-full rounded-xl border border-line bg-board p-4 transition-colors hover:border-accent/50"
              >
                <span className="grid h-28 place-items-center rounded-lg bg-gradient-to-br from-accent/20 via-panel to-down/10 font-mono text-xs text-muted">
                  {product.category}
                </span>
                <p className="mt-3 text-xs text-muted">{product.brand}</p>
                <h3 className="mt-1 font-medium">{product.name}</h3>
                {price ? (
                  <p className="mt-2 font-mono text-lg font-semibold">
                    {price}
                    {listPrice ? (
                      <span className="ml-2 text-xs text-muted line-through">{listPrice}</span>
                    ) : null}
                    {product.discountRate ? (
                      <span className="ml-2 text-xs text-up">{product.discountRate}%</span>
                    ) : null}
                  </p>
                ) : null}
                <p className="mt-2 text-xs leading-5 text-muted">{product.reason}</p>
                <span className="mt-3 inline-flex text-xs font-medium text-accent">
                  {storefront.copy.cta}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-[11px] leading-5 text-muted">{storefront.copy.disclosure}</p>
    </section>
  );
}
