import type { Metadata } from "next";
import { CategoryDeskGrid } from "@/components/dashboard/CategoryDeskGrid";
import { UnifiedMarketBoard } from "@/components/dashboard/UnifiedMarketBoard";
import { ContentSlot } from "@/components/monetization/ContentSlot";
import { PremiumColumnRail } from "@/components/posts/PremiumColumnRail";
import { getRankings } from "@/lib/api";
import { loadUnifiedMarket } from "@/lib/boards/composite-desk";
import { loadFeaturedColumns } from "@/lib/posts/featured";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import { SITE } from "@/lib/site";
import { rankingUrl } from "@/lib/slugs";

/**
 * Served from the ISR cache, rebuilt once a minute.
 *
 * Assembling this page costs a live rankings fetch plus four channels of board
 * seeding; paying that per visitor put TTFB in the hundreds of milliseconds for
 * data that only turns over on the minute anyway. The board refresh interval is
 * the same 60s, so a visitor never sees numbers older than one tick of the
 * countdown they are already watching.
 */
export const revalidate = 60;

const TITLE = "KINDEXLAB 실시간 화제 종합 지수(INDEX)";
const DESCRIPTION =
  "엔터테인먼트·정치·경제·문화/여행/맛집/레져/생활 실시간 지수를 한눈에 파악하는 통합 지수(INDEX)입니다.";

/** The landing page owns its own copy; the channel desks keep theirs. */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: SITE.url },
  twitter: { title: TITLE, description: DESCRIPTION },
};

const FEATURED_COLUMNS = 7;

export default async function HomePage() {
  const [unified, columns, market] = await Promise.all([
    loadUnifiedMarket(),
    loadFeaturedColumns(FEATURED_COLUMNS),
    getRankings().catch(() => ({
      updatedAt: new Date().toISOString(),
      status: "open" as const,
      indices: [],
      items: [],
    })),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: TITLE,
    description: DESCRIPTION,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: unified.items.length,
    itemListElement: unified.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: rankingUrl(SITE.url, item.slug),
      name: item.name,
    })),
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="space-y-1">
        <p className="font-sans text-xs font-semibold tracking-[0.14em] text-accent">
          KINDEXLAB MARKET MAP
        </p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{TITLE}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted">{DESCRIPTION}</p>
      </header>

      <ContentSlot placement="intro" label="종합 지수" />

      <UnifiedMarketBoard
        items={unified.items}
        updatedAt={market.updatedAt}
        status={market.status}
        refreshIntervalSec={DEFAULT_TRENDS_REVALIDATE_SEC}
      />

      <CategoryDeskGrid desks={unified.desks} />

      <ContentSlot placement="mid" label="종합 지수" />

      <PremiumColumnRail columns={columns} />

      <ContentSlot placement="footer" label="종합 지수" adFormat="auto" />
    </div>
  );
}
