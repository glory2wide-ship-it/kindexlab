import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryDeskGrid } from "@/components/dashboard/CategoryDeskGrid";
import { TREEMAP_FRAME_CLASS } from "@/components/dashboard/treemap-config";
import { UnifiedMarketBoard } from "@/components/dashboard/UnifiedMarketBoard";
import { LandingDeskHeader } from "@/components/layout/LandingDeskHeader";
import { ContentSlot } from "@/components/monetization/ContentSlot";
import { BriefingRail } from "@/components/briefing/BriefingRail";
import { slimBriefingsForCards } from "@/lib/briefing/card-dto";
import { loadFeaturedBriefings } from "@/lib/briefing/featured";
import { loadUnifiedMarket } from "@/lib/boards/composite-desk";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import { SITE, SITE_INDEX_HEADLINE, SITE_LANDING_HEADLINE } from "@/lib/site";
import { rankingUrl } from "@/lib/slugs";

/**
 * Served from the ISR cache, rebuilt every 3 minutes.
 *
 * All five desks are board-driven, so the landing no longer waits on
 * `getRankings()` before assembling tiles. Briefings ship as slim card DTOs.
 * Suspense streams the H1 shell before board/briefing work finishes.
 */
export const revalidate = 180;

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

const FEATURED_BRIEFINGS = 7;

function HeatmapSkeleton() {
  return (
    <div
      className={`${TREEMAP_FRAME_CLASS} animate-pulse rounded-xl border border-line/60 bg-panel`}
      aria-hidden
    />
  );
}

function BriefingSkeleton() {
  return (
    <div className="h-36 animate-pulse rounded-xl border border-line/60 bg-panel" aria-hidden />
  );
}

async function HomeBoardSection() {
  // No rankings waterfall — every POST_CHANNEL uses board heatmaps.
  const unified = await loadUnifiedMarket();
  const updatedAt = new Date().toISOString();

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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <UnifiedMarketBoard
        items={unified.items}
        updatedAt={updatedAt}
        status="open"
        refreshIntervalSec={DEFAULT_TRENDS_REVALIDATE_SEC}
      />
      <div className="order-3 space-y-4 md:order-3">
        <HomeDesksSection desks={unified.desks} />
      </div>
    </>
  );
}

function HomeDesksSection({
  desks,
}: {
  desks: Awaited<ReturnType<typeof loadUnifiedMarket>>["desks"];
}) {
  return (
    <>
      <ContentSlot placement="intro" label="종합 지수" />
      <CategoryDeskGrid desks={desks} refreshIntervalSec={DEFAULT_TRENDS_REVALIDATE_SEC} />
      <ContentSlot placement="mid" label="종합 지수" />
    </>
  );
}

async function HomeBriefingSection() {
  const briefings = slimBriefingsForCards(
    await loadFeaturedBriefings(FEATURED_BRIEFINGS).catch(() => []),
  );
  return (
    <>
      {/* Live desk briefings (today, or last successful edition until cron runs) */}
      <BriefingRail articles={briefings} />
      <ContentSlot placement="footer" label="종합 지수" adFormat="auto" />
    </>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/*
        Headcopy → ticker → board on every breakpoint.
        Category chips live in the root GlobalStickyMobileCategoryBar.
      */}
      <div className="flex flex-col gap-4">
        <div className="order-1">
          <LandingDeskHeader />
        </div>
        <Suspense
          fallback={
            <div className="order-3">
              <HeatmapSkeleton />
            </div>
          }
        >
          <HomeBoardSection />
        </Suspense>
      </div>

      <Suspense fallback={<BriefingSkeleton />}>
        <HomeBriefingSection />
      </Suspense>
    </div>
  );
}
