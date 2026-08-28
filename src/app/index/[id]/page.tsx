import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductShelf } from "@/components/affiliate/ProductShelf";
import { BuzzChart } from "@/components/entity/BuzzChart";
import { EntityHero } from "@/components/entity/EntityHero";
import { TodayAnalysis } from "@/components/entity/TodayAnalysis";
import { PollDeskSection } from "@/components/politics/PollDeskSection";
import { getRankings } from "@/lib/api";
import { composeTodayAnalysis } from "@/lib/editorial/today-analysis";
import { TYPE_LABEL, formatRate } from "@/lib/format";
import { APPROVAL_INDEX_ID } from "@/lib/ingestion/composite";
import {
  APPROVAL_PATH,
  constituentsForIndex,
  entityFromIndex,
  indexPath,
  listIndexIds,
} from "@/lib/indices";
import { SITE } from "@/lib/site";
import { rankingPath } from "@/lib/slugs";
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
  const todayAnalysis = composeTodayAnalysis({ entity, market, related });

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          시세판
        </Link>
        <span className="mx-2">/</span>
        {index.label}
      </p>
      <EntityHero entity={entity} kicker={`섹터 지수 · ${index.note}`} />
      <BuzzChart entity={entity} initialTimeframe={initialTimeframe} />
      <TodayAnalysis article={todayAnalysis} entityHref={`${indexPath(index.id)}#chart`} />
      <ProductShelf products={entity.products} entityName={index.label} />
      <PollDeskSection entity={pollLead} market={market} related={related} />
      {related.length ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">구성 종목</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {related.map((item) => (
              <li key={item.id}>
                <Link
                  href={rankingPath(item.slug)}
                  className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 hover:border-accent/40"
                >
                  <span>
                    <span className="block text-xs text-muted">
                      {TYPE_LABEL[item.type]} · {item.rank}위
                    </span>
                    <span className="font-medium">{item.name}</span>
                  </span>
                  <span
                    className={`font-sans text-sm tabular-nums ${
                      item.fluctuationRate > 0
                        ? "text-up"
                        : item.fluctuationRate < 0
                          ? "text-down"
                          : "text-muted"
                    }`}
                  >
                    {formatRate(item.fluctuationRate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="sr-only">{SITE.name} 섹터 지수 상세</p>
    </div>
  );
}
