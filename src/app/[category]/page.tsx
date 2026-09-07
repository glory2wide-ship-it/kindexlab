import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { ChannelMarketDesk } from "@/components/dashboard/ChannelMarketDesk";
import { loadChannelDeskData } from "@/lib/boards/channel-page-data";
import { getPostChannel, isPostChannel, LIVE_INDEX_LABEL } from "@/lib/posts/channels";

/** ISR: matches the 3-minute live board refresh cadence. */
export const revalidate = 180;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isPostChannel(category)) return { title: LIVE_INDEX_LABEL };
  const meta = getPostChannel(category);
  return {
    title: `${meta.label} ${LIVE_INDEX_LABEL}`,
    description: `${meta.indexTitle}와 종합 브리핑, Update 키워드를 한 페이지에서 봅니다. ${meta.description}`,
    alternates: { canonical: meta.href },
  };
}

function BriefingFallback() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-8 w-48 animate-pulse rounded bg-line/70" />
      <div className="h-40 animate-pulse rounded-2xl bg-line/40" />
    </div>
  );
}

export default async function CategoryBoardPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isPostChannel(category)) notFound();

  // Desk first (boards + rankings). Briefing streams in via Suspense so soft-nav
  // paints the heatmap without waiting on the multi-MB briefing catalog.
  const { boards, liveMarket, initialItems, initialQuotedByBoard } = await loadChannelDeskData(category);

  return (
    <div className="space-y-8">
      <ChannelMarketDesk
        channel={category}
        boards={boards}
        liveMarket={liveMarket}
        initialItems={initialItems}
        initialQuotedByBoard={initialQuotedByBoard}
      />
      <section className="border-t border-line pt-8">
        <Suspense fallback={<BriefingFallback />}>
          <ChannelBriefingPage channel={category} titleLevel={2} />
        </Suspense>
      </section>
    </div>
  );
}
