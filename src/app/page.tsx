import { BriefingRail } from "@/components/briefing/BriefingRail";
import { LiveMarketBoard } from "@/components/dashboard/LiveMarketBoard";
import { getRankings, getTodaysBriefings, parseCategoryParam } from "@/lib/api";
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
  const [market, today] = await Promise.all([getRankings(), getTodaysBriefings()]);
  const main = today.find((item) => item.kind === "main") ?? today[0];
  const dives = today.filter((item) => item.kind === "deep-dive");

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
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LiveMarketBoard
        initialMarket={market}
        initialCategory={initialCategory}
        refreshIntervalSec={DEFAULT_TRENDS_REVALIDATE_SEC}
      >
        <header className="space-y-2">
          <p className="font-sans text-xs font-semibold tracking-[0.14em] text-accent">
            KINDEXLAB MARKET MAP
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            K-컬처 화제 시세판
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            트리맵과 리스트로 K-POP·셀럽·방송·인플루언서·음원 차트·시청률·웹툰·숏폼/SNS·게임을 읽습니다.
            <br />
            박스 크기는 거래량, 색상은 등락률입니다. 상승 빨강 · 하락 파랑.
          </p>
        </header>
      </LiveMarketBoard>
      {main ? <BriefingRail main={main} dives={dives} /> : null}
    </div>
  );
}
