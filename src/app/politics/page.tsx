import type { Metadata } from "next";
import { Suspense } from "react";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { ChannelMarketDesk } from "@/components/dashboard/ChannelMarketDesk";
import { loadChannelDeskData } from "@/lib/boards/channel-page-data";
import { getPostChannel, LIVE_INDEX_LABEL } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

/** ISR: matches the 3-minute live board refresh cadence. */
export const revalidate = 180;

const meta = getPostChannel("politics");

export const metadata: Metadata = {
  title: `${meta.label} ${LIVE_INDEX_LABEL}`,
  description:
    "정치 종합 브리핑과 헤드라인·대통령·정당 등 Update 키워드, 히트맵 지수를 같은 페이지에서 봅니다.",
  alternates: { canonical: meta.href },
  openGraph: {
    title: `${meta.indexTitle} · ${SITE.name}`,
    description: "정치 종합 브리핑과 Update 키워드, 3분봉 히트맵 지수.",
    url: `${SITE.url}/politics`,
  },
};

export default async function PoliticsBoardPage() {
  const { boards, liveMarket } = await loadChannelDeskData("politics");

  return (
    <div className="space-y-8">
      <ChannelMarketDesk channel="politics" boards={boards} liveMarket={liveMarket} />
      <section className="border-t border-line pt-8">
        <Suspense
          fallback={
            <div className="space-y-3" aria-hidden>
              <div className="h-8 w-48 animate-pulse rounded bg-line/70" />
              <div className="h-40 animate-pulse rounded-2xl bg-line/40" />
            </div>
          }
        >
          <ChannelBriefingPage channel="politics" titleLevel={2} />
        </Suspense>
      </section>
    </div>
  );
}
