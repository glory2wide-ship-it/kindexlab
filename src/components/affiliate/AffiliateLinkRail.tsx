import { ProductShelf } from "@/components/affiliate/ProductShelf";
import { coupangSearchUrl } from "@/lib/coupang";
import { affiliateKeyword } from "@/lib/posts/channels";
import { bokjiroSearchUrl, govSupportSearchUrl } from "@/lib/politics/types";
import { tossShoppingUrl } from "@/lib/toss";
import type { PostChannel } from "@/lib/posts/types";
import type { AffiliateProduct } from "@/lib/types";

export function AffiliateLinkRail({
  channel,
  keyword,
  entityName,
  products = [],
}: {
  channel: PostChannel;
  keyword?: string;
  entityName?: string;
  products?: AffiliateProduct[];
}) {
  const query = affiliateKeyword(channel, keyword);
  const label = entityName || query;
  const politics = channel === "politics";

  return (
    <div className="space-y-4" data-monetization="affiliate-rail">
      <section className="rounded-2xl border border-line bg-panel p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Affiliate</p>
        <h2 className="mt-2 text-lg font-semibold">
          {politics ? `${query} · 토스쇼핑·정부24` : `${query} 제휴 최저가`}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          {politics
            ? "토스 쇼핑은 관련 실무·시사 용품 검색용입니다. 지원금 신청·자격 조회는 정부24와 복지로에서 확인하세요."
            : "쿠팡 파트너스와 토스 쇼핑 검색으로 같은 키워드의 판매 페이지를 엽니다. 가격은 제휴몰 기준입니다."}
        </p>
        <div className={`mt-4 grid gap-3 ${politics ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}>
          <a
            href={coupangSearchUrl(query)}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="rounded-xl border border-line bg-board px-4 py-3 text-sm hover:border-accent"
          >
            <span className="block font-mono text-[11px] text-muted">Coupang Partners</span>
            <span className="mt-1 block font-medium">쿠팡에서 {query} 보기 →</span>
          </a>
          <a
            href={tossShoppingUrl(query)}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="rounded-xl border border-line bg-board px-4 py-3 text-sm hover:border-accent"
          >
            <span className="block font-mono text-[11px] text-muted">Toss Shopping</span>
            <span className="mt-1 block font-medium">토스쇼핑에서 {query} 보기 →</span>
          </a>
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
      {products.length ? <ProductShelf products={products} entityName={label} /> : null}
    </div>
  );
}
