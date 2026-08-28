import { BriefingRail } from "@/components/briefing/BriefingRail";
import { LiveMarketBoard } from "@/components/dashboard/LiveMarketBoard";
import { getChannelBriefingEdition, getRankings, parseCategoryParam, splitChannelEdition } from "@/lib/api";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import { SITE } from "@/lib/site";
import { rankingUrl } from "@/lib/slugs";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const initialCategory = parseCategoryParam(params.category) ?? "all";
  const [market, edition] = await Promise.all([
    getRankings(),
    getChannelBriefingEdition("entertainment"),
  ]);
  const { main, dives } = splitChannelEdition(edition);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${SITE.name} 실시간 화제 순위`,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: market.items.length,
    itemListElement: market.items.map((item) => ({
      "@type": "ListItem",
      position: item.rank,
      url: rankingUrl(SITE.url, item.slug),
      name: item.name,
    })),
  };

  return (
    <div className="space-y-3">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LiveMarketBoard
        initialMarket={market}
        initialCategory={initialCategory}
        refreshIntervalSec={DEFAULT_TRENDS_REVALIDATE_SEC}
        compact
      >
        <header className="space-y-1">
          <p className="font-sans text-xs font-semibold tracking-[0.14em] text-accent">
            KINDEXLAB MARKET MAP
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">K-컬처 화제 시세판</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            엔터테인먼트·정치·경제·문화 실시간 지수입니다. 상승 빨강 · 하락 파랑.
          </p>
        </header>
      </LiveMarketBoard>
      {main ? <BriefingRail main={main} dives={dives} /> : null}
    </div>
  );
}
