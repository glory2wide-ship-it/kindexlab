import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense, cache } from "react";
import { BuzzChart } from "@/components/entity/BuzzChart";
import { EntityHero } from "@/components/entity/EntityHero";
import { RelatedRankingDesk } from "@/components/entity/RelatedRankingDesk";
import { TodayAnalysis } from "@/components/entity/TodayAnalysis";
import { PollDeskSection } from "@/components/politics/PollDeskSection";
import { SetActiveChannel } from "@/components/providers/ActiveChannelProvider";
import { getOrCreateAnalysis } from "@/lib/analysis/pipeline";
import { isGeminiAnalysis } from "@/lib/analysis/quality";
import { getRankings } from "@/lib/api";
import type { TodayAnalysisArticle } from "@/lib/editorial/today-analysis";
import { formatRate } from "@/lib/format";
import { APPROVAL_INDEX_ID } from "@/lib/ingestion/composite";
import {
  APPROVAL_PATH,
  constituentsForIndex,
  entityFromIndex,
  indexPath,
  listIndexIds,
} from "@/lib/indices";
import { channelFromLead } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";
import { parseTimeframeParam } from "@/lib/timeframes";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  return listIndexIds().map((id) => ({ id }));
}

const loadIndexDetail = cache(async (id: string) => {
  const market = await getRankings();
  const index = market.indices.find((item) => item.id === id);
  if (!index) return null;
  const entity = entityFromIndex(index, market.items);
  const related = constituentsForIndex(index.id, market.items).slice(0, 8);
  return { market, index, entity, related };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (id === APPROVAL_INDEX_ID) return { title: "대통령 지지도" };
  const detail = await loadIndexDetail(id);
  if (!detail) return { title: "지수를 찾을 수 없습니다" };
  return {
    title: `${detail.index.label} · ${formatRate(detail.index.changeRate)}`,
    description: detail.index.note,
    alternates: { canonical: indexPath(detail.index.id) },
  };
}

export default async function IndexDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tf?: string }>;
}) {
  const { id } = await params;
  if (id === APPROVAL_INDEX_ID) redirect(APPROVAL_PATH);
  const query = searchParams ? await searchParams : {};
  const detail = await loadIndexDetail(id);
  if (!detail) notFound();
  const { index, entity, related } = detail;
  const pollLead = related[0] ?? entity;
  const initialTimeframe = parseTimeframeParam(query.tf) ?? "3m";

  return (
    <div className="space-y-8">
      <SetActiveChannel channel={entity.sourceChannel ?? channelFromLead(entity, entity.slug)} />
      <p className="text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          지수(INDEX)
        </Link>
        <span className="mx-2">/</span>
        {index.label}
      </p>
      <EntityHero entity={entity} kicker={`섹터 지수 · ${index.note}`} />
      <BuzzChart entity={entity} initialTimeframe={initialTimeframe} />
      <Suspense fallback={null}>
        <IndexAnalysisSlot id={id} entity={entity} related={related} />
      </Suspense>
      <Suspense fallback={null}>
        <PollDeskSection entity={pollLead} related={related} />
      </Suspense>
      {related.length ? (
        <RelatedRankingDesk entity={entity} related={related} heading="구성 종목" />
      ) : null}
      <p className="sr-only">{SITE.name} 섹터 지수 상세</p>
    </div>
  );
}

async function IndexAnalysisSlot({
  id,
  entity,
  related,
}: {
  id: string;
  entity: RankingEntity;
  related: RankingEntity[];
}) {
  const detail = await loadIndexDetail(id);
  if (!detail) return null;
  let analysisArticle: TodayAnalysisArticle | undefined;
  try {
    const analysis = await getOrCreateAnalysis({
      entity,
      market: detail.market as RankingsPayload,
      related,
    });
    if (analysis.entry && isGeminiAnalysis(analysis.entry)) analysisArticle = analysis.entry.article;
  } catch {
    /* charts and constituents stand alone until Gemini fills the column */
  }
  if (!analysisArticle) return null;
  return <TodayAnalysis article={analysisArticle} entityHref={`${indexPath(id)}#chart`} />;
}
