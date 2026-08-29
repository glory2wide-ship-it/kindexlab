import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BuzzChart } from "@/components/entity/BuzzChart";
import { EntityHero } from "@/components/entity/EntityHero";
import { RelatedRankingDesk } from "@/components/entity/RelatedRankingDesk";
import { TodayAnalysis } from "@/components/entity/TodayAnalysis";
import { PollDeskSection } from "@/components/politics/PollDeskSection";
import { getOrCreateAnalysis } from "@/lib/analysis/pipeline";
import { getRankings } from "@/lib/api";
import { formatRate } from "@/lib/format";
import { APPROVAL_INDEX_ID } from "@/lib/ingestion/composite";
import {
  APPROVAL_PATH,
  constituentsForIndex,
  entityFromIndex,
  indexPath,
  listIndexIds,
} from "@/lib/indices";
import { SITE } from "@/lib/site";
import { parseTimeframeParam } from "@/lib/timeframes";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateStaticParams() {
  return listIndexIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (id === APPROVAL_INDEX_ID) return { title: "대통령 지지도" };
  const market = await getRankings();
  const index = market.indices.find((item) => item.id === id);
  if (!index) return { title: "지수를 찾을 수 없습니다" };
  return {
    title: `${index.label} · ${formatRate(index.changeRate)}`,
    description: index.note,
    alternates: { canonical: indexPath(index.id) },
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
  const market = await getRankings();
  const index = market.indices.find((item) => item.id === id);
  if (!index) notFound();
  const entity = entityFromIndex(index, market.items);
  const related = constituentsForIndex(index.id, market.items).slice(0, 8);
  const pollLead = related[0] ?? entity;
  const initialTimeframe = parseTimeframeParam(query.tf) ?? "5m";
  const analysis = await getOrCreateAnalysis({ entity, market, related });

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          지수(INDEX)
        </Link>
        <span className="mx-2">/</span>
        {index.label}
      </p>
      <EntityHero entity={entity} kicker={`섹터 지수 · ${index.note}`} />
      <BuzzChart entity={entity} initialTimeframe={initialTimeframe} />
      <TodayAnalysis article={analysis.entry.article} entityHref={`${indexPath(index.id)}#chart`} />
      <PollDeskSection entity={pollLead} market={market} related={related} />
      {related.length ? (
        <RelatedRankingDesk entity={entity} related={related} heading="구성 종목" />
      ) : null}
      <p className="sr-only">{SITE.name} 섹터 지수 상세</p>
    </div>
  );
}
