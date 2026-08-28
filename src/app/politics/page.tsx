import type { Metadata } from "next";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { LiveMarketBoard } from "@/components/dashboard/LiveMarketBoard";
import { getRankings } from "@/lib/api";
import { getPostChannel } from "@/lib/posts/channels";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

const meta = getPostChannel("politics");

export const metadata: Metadata = {
  title: "K 정치 시세판",
  description:
    "정치 종합 브리핑과 헤드라인·대통령·정당 등 10개 하부 메뉴 심층 분석, 트리맵 시세판을 같은 페이지에서 봅니다.",
  alternates: { canonical: meta.href },
  openGraph: {
    title: `K 정치 시세판 · ${SITE.name}`,
    description: "정치 종합 브리핑과 하부 메뉴 심층 분석, 5분봉 시세판.",
    url: `${SITE.url}/politics`,
  },
};

export default async function PoliticsBoardPage() {
  const market = await getRankings();

  return (
    <div className="space-y-8">
      <LiveMarketBoard
        initialMarket={market}
        refreshIntervalSec={DEFAULT_TRENDS_REVALIDATE_SEC}
        channel="politics"
        compact
      >
        <header className="space-y-1">
          <p className="font-sans text-xs font-semibold tracking-[0.14em] text-accent">
            POLITICS ISSUE MAP
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">K 정치 시세판</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            트리맵과 리스트로 정치뉴스, 정당 및 정치인, 평론가, 인플루언서 지수를 읽습니다. 박스 크기는
            거래량, 색상은 등락률입니다. 상승 빨강·하락 파랑.
          </p>
        </header>
      </LiveMarketBoard>
      <section className="border-t border-line pt-8">
        <ChannelBriefingPage channel="politics" titleLevel={2} />
      </section>
    </div>
  );
}
