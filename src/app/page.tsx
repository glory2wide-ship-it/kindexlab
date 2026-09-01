import type { Metadata } from "next";
import Script from "next/script";
import { CategoryDeskGrid } from "@/components/dashboard/CategoryDeskGrid";
import { UnifiedMarketBoard } from "@/components/dashboard/UnifiedMarketBoard";
import { LandingDeskHeader } from "@/components/layout/LandingDeskHeader";
import { ContentSlot } from "@/components/monetization/ContentSlot";
import { PremiumColumnRail } from "@/components/posts/PremiumColumnRail";
import { getRankings } from "@/lib/api";
import { loadUnifiedMarket } from "@/lib/boards/composite-desk";
import { loadFeaturedColumns } from "@/lib/posts/featured";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import { SITE, SITE_INDEX_HEADLINE, SITE_LANDING_HEADLINE } from "@/lib/site";
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

const TITLE = SITE_INDEX_HEADLINE;
const DESCRIPTION = SITE_LANDING_HEADLINE;

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
  // Awaited first: the unified board now ranks from these rows, so it can no
  // longer be built in parallel with the fetch that produces them.
  const market = await getRankings().catch(() => ({
    updatedAt: new Date().toISOString(),
    status: "open" as const,
    indices: [],
    items: [],
  }));
  const [unified, columns] = await Promise.all([
    loadUnifiedMarket(market),
    loadFeaturedColumns(FEATURED_COLUMNS),
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
      <Script
        id="home-itemlist-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ContentSlot placement="intro" label="종합 지수" />

      <div className="space-y-4">
        <LandingDeskHeader />
        <UnifiedMarketBoard
          items={unified.items}
          updatedAt={market.updatedAt}
          status={market.status}
          refreshIntervalSec={DEFAULT_TRENDS_REVALIDATE_SEC}
        />
      </div>

      <CategoryDeskGrid desks={unified.desks} />

      <ContentSlot placement="mid" label="종합 지수" />

      <PremiumColumnRail columns={columns} />

      <ContentSlot placement="footer" label="종합 지수" adFormat="auto" />
    </div>
  );
}
