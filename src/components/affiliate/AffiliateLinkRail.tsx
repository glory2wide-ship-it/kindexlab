import { ProductShelf } from "@/components/affiliate/ProductShelf";
import { resolveAffiliateProviders } from "@/lib/affiliate";
import { railCopy } from "@/lib/affiliate/copy";
import { activeMarket, type MarketConfig } from "@/lib/market/config";
import { affiliateKeyword } from "@/lib/posts/channels";
import { bokjiroSearchUrl, govSupportSearchUrl } from "@/lib/politics/types";
import type { PostChannel } from "@/lib/posts/types";
import type { AffiliateProduct } from "@/lib/types";

export function AffiliateLinkRail({
  channel,
  keyword,
  entityName,
  products = [],
  market = activeMarket(),
}: {
  channel: PostChannel;
  keyword?: string;
  entityName?: string;
  products?: AffiliateProduct[];
  market?: MarketConfig;
}) {
  const query = affiliateKeyword(channel, keyword);
  const label = entityName || query;
  const providers = resolveAffiliateProviders(market);
  // Government service lookups only exist for the Korean market.
  const politics = channel === "politics" && market.country === "KR";
  const copy = railCopy(market, query, providers);

  const tiles = providers.length + (politics ? 2 : 0);

  return (
    <div className="space-y-4" data-monetization="affiliate-rail">
      <section className="rounded-2xl border border-line bg-panel p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Affiliate</p>
        <h2 className="mt-2 text-lg font-semibold">
          {politics ? `${query} · 제휴 쇼핑·정부24` : copy.heading}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          {politics
            ? "제휴 쇼핑 링크는 관련 실무·시사 용품 검색용입니다. 지원금 신청·자격 조회는 정부24와 복지로에서 확인하세요."
            : copy.intro}
        </p>
        <div
          className={`mt-4 grid gap-3 ${tiles > 2 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}
        >
          {providers.map((provider) => (
            <a
              key={provider.id}
              href={provider.searchUrl(query, market)}
              target="_blank"
              rel="sponsored noopener noreferrer"
              data-affiliate-provider={provider.id}
              className="rounded-xl border border-line bg-board px-4 py-3 text-sm hover:border-accent"
            >
              <span className="block font-mono text-[11px] text-muted">{provider.label}</span>
              <span className="mt-1 block font-medium">{provider.copy.railCta(query)} →</span>
            </a>
          ))}
          {politics ? (
            <>
              <a
                href={govSupportSearchUrl(query)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-line bg-board px-4 py-3 text-sm hover:border-accent"
              >
                <span className="block font-mono text-[11px] text-muted">정부24</span>
                <span className="mt-1 block font-medium">{query} 신청·안내 →</span>
              </a>
              <a
                href={bokjiroSearchUrl(query)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-line bg-board px-4 py-3 text-sm hover:border-accent"
              >
                <span className="block font-mono text-[11px] text-muted">복지로</span>
                <span className="mt-1 block font-medium">복지 서비스 검색 →</span>
              </a>
            </>
          ) : null}
        </div>
      </section>
      {products.length ? (
        <ProductShelf products={products} entityName={label} market={market} />
      ) : null}
    </div>
  );
}
