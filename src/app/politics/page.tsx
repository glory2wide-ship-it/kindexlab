import type { Metadata } from "next";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { ChannelMarketDesk } from "@/components/dashboard/ChannelMarketDesk";
import { getRankings } from "@/lib/api";
import { stripBoardDemographics } from "@/lib/boards/heatmap";
import { channelLiveMarket, loadChannelHeatmapPayloads } from "@/lib/boards/heatmap-server";
import { seedMissingBoards } from "@/lib/boards/seed";
import { getPostChannel, LIVE_INDEX_LABEL } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";
import type { RankingsPayload } from "@/lib/types";

/** ISR: see the landing page for why 60s matches the board refresh cadence. */
export const revalidate = 60;

const meta = getPostChannel("politics");

export const metadata: Metadata = {
  title: `${meta.label} ${LIVE_INDEX_LABEL}`,
  description:
    "정치 종합 브리핑과 헤드라인·대통령·정당 등 하부 메뉴 심층 분석, 히트맵 지수를 같은 페이지에서 봅니다.",
  alternates: { canonical: meta.href },
  openGraph: {
    title: `${meta.indexTitle} · ${SITE.name}`,
    description: "정치 종합 브리핑과 하부 메뉴 심층 분석, 5분봉 히트맵 지수.",
    url: `${SITE.url}/politics`,
  },
};

export default async function PoliticsBoardPage() {
  let market: RankingsPayload;
  try {
    market = await getRankings();
  } catch {
    market = { updatedAt: new Date().toISOString(), status: "open", indices: [], items: [] };
  }
  try {
    await seedMissingBoards();
  } catch {
    /* best-effort */
  }
  const boards = await loadChannelHeatmapPayloads("politics");

  return (
    <div className="space-y-8">
      <ChannelMarketDesk
        channel="politics"
        boards={stripBoardDemographics(boards)}
        liveMarket={channelLiveMarket(market, "politics", boards)}
      />
      <section className="border-t border-line pt-8">
        <ChannelBriefingPage channel="politics" titleLevel={2} />
      </section>
    </div>
  );
}
