import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelBriefingPage } from "@/components/briefing/ChannelBriefingPage";
import { LiveMarketBoard } from "@/components/dashboard/LiveMarketBoard";
import { getRankings } from "@/lib/api";
import { getPostChannel, isPostChannel } from "@/lib/posts/channels";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isPostChannel(category)) return { title: "시세판" };
  const meta = getPostChannel(category);
  return {
    title: `${meta.label} 시세판`,
    description: `${meta.label} 시세판과 종합 브리핑, 하부 메뉴 심층 분석을 한 페이지에서 봅니다. ${meta.description}`,
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
  const market = await getRankings();

  return (
    <div className="space-y-8">
      <LiveMarketBoard
        initialMarket={market}
        refreshIntervalSec={DEFAULT_TRENDS_REVALIDATE_SEC}
        channel={category}
        compact
      >
        <header className="space-y-1">
          <p className="font-sans text-xs font-semibold tracking-[0.14em] text-accent">
            {meta.eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{meta.label} 시세판</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            {meta.label} 실시간 지수와 종목 수치입니다. 상승 빨강 · 하락 파랑.
          </p>
        </header>
      </LiveMarketBoard>
      <section className="border-t border-line pt-8">
        <ChannelBriefingPage channel={category} titleLevel={2} />
      </section>
    </div>
  );
}
