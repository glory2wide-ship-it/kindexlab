import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelDeskWithBriefing } from "@/components/dashboard/ChannelDeskWithBriefing";
import { getChannelBriefingEdition, getRankings, splitChannelEdition } from "@/lib/api";
import { stripBoardDemographics } from "@/lib/boards/heatmap";
import { channelLiveMarket, loadChannelHeatmapPayloads } from "@/lib/boards/heatmap-server";
import { seedMissingBoards } from "@/lib/boards/seed";
import { getPostChannel, isPostChannel, LIVE_INDEX_LABEL } from "@/lib/posts/channels";
import type { RankingsPayload } from "@/lib/types";

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

  // Board rail ↔ index cards ↔ 심층 분석 stay 1:1 (travel includes 여행 정부지원금).
  let main;
  let dives: Awaited<ReturnType<typeof splitChannelEdition>>["dives"] = [];
  try {
    const edition = await getChannelBriefingEdition(category);
    const split = splitChannelEdition(edition);
    main = split.main;
    dives = split.dives;
  } catch {
    main = undefined;
    dives = [];
  }
  return (
    <ChannelDeskWithBriefing
      channel={category}
      boards={stripBoardDemographics(boards)}
      liveMarket={channelLiveMarket(market, category, boards)}
      main={main}
      dives={dives}
      titleLevel={2}
    />
  );
}
