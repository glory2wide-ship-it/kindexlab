import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { ChannelMarketDesk } from "@/components/dashboard/ChannelMarketDesk";
import { getRankings } from "@/lib/api";
import { stripBoardDemographics } from "@/lib/boards/heatmap";
import { channelLiveMarket, loadChannelHeatmapPayloads } from "@/lib/boards/heatmap-server";
import { seedMissingBoards } from "@/lib/boards/seed";
import { getPostChannel, isPostChannel, LIVE_INDEX_LABEL } from "@/lib/posts/channels";
import type { RankingsPayload } from "@/lib/types";

/** ISR: see the landing page for why 60s matches the board refresh cadence. */
export const revalidate = 60;

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
    description: `${meta.indexTitle}와 종합 브리핑, 하부 메뉴 심층 분석을 한 페이지에서 봅니다. ${meta.description}`,
    alternates: { canonical: meta.href },
  };
}

export default async function CategoryBoardPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isPostChannel(category)) notFound();
  const meta = getPostChannel(category);
  let market: RankingsPayload;
  try {
    market = await getRankings();
  } catch {
    market = { updatedAt: new Date().toISOString(), status: "open", indices: [], items: [] };
  }
  try {
    await seedMissingBoards();
  } catch {
    /* sample seed is best-effort — the rail still renders */
  }
  const boards = await loadChannelHeatmapPayloads(category);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="font-sans text-xs font-semibold tracking-[0.14em] text-accent">
          {meta.eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{meta.indexTitle}</h1>
      </header>
      <ChannelMarketDesk
        channel={category}
        boards={stripBoardDemographics(boards)}
        liveMarket={channelLiveMarket(market, category, boards)}
      />
      <section className="border-t border-line pt-8">
        <ChannelBriefingPage channel={category} titleLevel={2} />
      </section>
    </div>
  );
}
