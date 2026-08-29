"use client";

import { defaultAffiliateForChannel, resolveAffiliateCategory } from "@/lib/affiliate/catalog";
import { primaryAffiliateProvider, resolveAffiliateProviders } from "@/lib/affiliate";
import { filterLabel } from "@/lib/boards/demographics";
import type { AgeSegment, GenderSegment } from "@/lib/boards/types";
import { activeMarket } from "@/lib/market/config";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Affiliate shelf for a ranking board or an article. Gender and age tabs swap
 * the product category so a 50s economy reader sees a different shelf from a
 * 20s culture reader.
 *
 * Generated columns mount this by focus keyword alone (`<AffiliateWidget
 * keyword="..." />`); the keyword then both picks the fallback category and
 * leads the shelf, so the first offer tracks what the reader came for.
 */
export function AffiliateWidget({
  category,
  keyword,
  channel,
  boardSlug,
  gender = "all",
  age = "all",
  placement = "mid",
}: {
  category?: string;
  keyword?: string;
  channel?: PostChannel;
  boardSlug?: string;
  gender?: "all" | GenderSegment;
  age?: "all" | AgeSegment;
  placement?: "mid" | "footer";
}) {
  const market = activeMarket();
  const provider = primaryAffiliateProvider(market);
  const boardCategory =
    category || (channel ? defaultAffiliateForChannel(channel) : "") || "생필품 핫딜";
  let resolved;
  try {
    resolved = resolveAffiliateCategory({ boardCategory, channel, boardSlug, gender, age });
  } catch {
    resolved = resolveAffiliateCategory("생필품 핫딜");
  }
  const catalogOffers = resolved?.offers?.filter((offer) => offer?.query && offer?.label) ?? [];
  const focus = keyword?.trim();
  const offers = focus
    ? [
        { query: focus, label: `${focus} 관련 상품`, reason: `${focus}를 찾아본 독자가 함께 본 품목` },
        ...catalogOffers.filter((offer) => offer.query !== focus),
      ].slice(0, catalogOffers.length || 3)
    : catalogOffers;
  const heading = focus ? `${focus} 추천 아이템` : resolved?.heading || "추천 아이템";
  const leadQuery = offers[0]?.query ?? heading;
  const others = (resolveAffiliateProviders(market) ?? []).filter((item) => item?.id && item.id !== provider.id);
  const targeted = gender !== "all" || age !== "all";
  const chip = filterLabel(gender, age);
  const searchUrl = (query: string) => {
    try {
      return provider.searchUrl(query, market);
    } catch {
      return `https://www.coupang.com/np/search?q=${encodeURIComponent(query)}`;
    }
  };

  if (!offers.length) {
    return (
      <section
        data-affiliate-widget={placement}
        className="not-prose rounded-2xl border border-dashed border-line bg-panel px-5 py-4"
      >
        <p className="text-xs font-semibold tracking-[0.14em] text-accent">{provider.label}</p>
        <p className="mt-1 text-sm text-muted">제휴 상품을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.</p>
      </section>
    );
  }

  return (
    <section
      data-affiliate-widget={placement}
      data-affiliate-category={resolved.id ?? "default"}
      className="not-prose overflow-hidden rounded-2xl border border-line bg-panel"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-accent">{provider.label}</p>
          <h3 className="mt-0.5 text-sm font-semibold">
            {heading}
            {targeted ? (
              <span className="ml-2 rounded-full bg-board px-2 py-0.5 text-[11px] font-medium text-muted">
                {chip} 맞춤
              </span>
            ) : null}
          </h3>
        </div>
        <a
          href={searchUrl(leadQuery)}
          target="_blank"
          rel="nofollow sponsored noopener"
          className="text-xs font-medium text-accent hover:underline"
        >
          {provider.copy?.cta ?? "검색하기"}
        </a>
      </div>

      <ul className="grid gap-px bg-line sm:grid-cols-3">
        {offers.map((offer) => (
          <li key={offer.query} className="bg-panel">
            <a
              href={searchUrl(offer.query)}
              target="_blank"
              rel="nofollow sponsored noopener"
              className="flex h-full flex-col gap-1 px-4 py-3 hover:bg-board/60"
            >
              <span className="text-sm font-semibold">{offer.label}</span>
              <span className="text-xs leading-5 text-muted">{offer.reason}</span>
            </a>
          </li>
        ))}
      </ul>

      {others.length ? (
        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
          {others.map((item) => (
            <a
              key={item.id}
              href={searchUrl(leadQuery)}
              target="_blank"
              rel="nofollow sponsored noopener"
              className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink"
            >
              {typeof item.copy?.railCta === "function"
                ? item.copy.railCta(offers[0]?.label ?? heading)
                : item.label}
            </a>
          ))}
        </div>
      ) : null}

      <p className="border-t border-line px-5 py-2.5 text-[11px] leading-5 text-muted">
        {provider.copy?.disclosure ?? "이 포스팅은 제휴마케팅이 포함된 광고일 수 있습니다."}
      </p>
    </section>
  );
}
