import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense, cache } from "react";
import { BuzzChart } from "@/components/entity/BuzzChart";
import { EntityHero } from "@/components/entity/EntityHero";
import { RelatedBriefingLinks } from "@/components/entity/RelatedBriefingLinks";
import { RelatedRankingDesk } from "@/components/entity/RelatedRankingDesk";
import { TodayAnalysis } from "@/components/entity/TodayAnalysis";
import { PollDeskSection } from "@/components/politics/PollDeskSection";
import { SupportIndexChart } from "@/components/politics/SupportIndexChart";
import { getOrCreateAnalysis } from "@/lib/analysis/pipeline";
import { isGeminiAnalysis } from "@/lib/analysis/quality";
import { readAnalysisForEntity } from "@/lib/analysis/store";
import { getEntityBySlug, getRankings, getRelatedEntities } from "@/lib/api";
import type { TodayAnalysisArticle } from "@/lib/editorial/today-analysis";
import {
  breadcrumbJsonLd,
  entityDatasetJsonLd,
  entitySeoDescription,
  entitySeoTitle,
  isIndexableEntityPage,
} from "@/lib/seo/indexable-entity";
import { SITE } from "@/lib/site";
import { decodeRouteSlug, politicsDetailPath, rankingPath } from "@/lib/slugs";
import { parseTimeframeParam } from "@/lib/timeframes";
import type { RankingEntity } from "@/lib/types";

export const revalidate = 60;
export const dynamicParams = true;

const RESERVED = new Set(["briefing", "archive", "posts", "about"]);

const loadEntity = cache(async (id: string, name?: string) => {
  return (await getEntityBySlug(id, name)) ?? null;
});

const loadRelated = cache(async (id: string, name?: string) => {
  const entity = await loadEntity(id, name);
  if (!entity) return [] as RankingEntity[];
  return getRelatedEntities(entity);
});

const loadAnalysisArticle = cache(async (id: string, name?: string) => {
  const entity = await loadEntity(id, name);
  if (!entity) return null;
  let article: TodayAnalysisArticle | undefined;
  try {
    const [related, market] = await Promise.all([loadRelated(id, name), getRankings()]);
    const analysis = await getOrCreateAnalysis({ entity, market, related });
    if (analysis.entry && isGeminiAnalysis(analysis.entry)) article = analysis.entry.article;
  } catch {
    /* data sections stand alone */
  }
  return { article, name: entity.name };
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ name?: string; tf?: string }>;
}): Promise<Metadata> {
  const { id: raw } = await params;
  const id = decodeRouteSlug(raw);
  if (RESERVED.has(id)) return { title: "정치" };
  const query = searchParams ? await searchParams : {};
  const entity = await loadEntity(id, typeof query.name === "string" ? query.name : undefined);
  if (!entity) return { title: "종목을 찾을 수 없습니다" };
  const analysis = await readAnalysisForEntity(entity.slug, entity.name);
  const indexable = isIndexableEntityPage(entity, analysis);
  const title = entitySeoTitle(entity);
  const description = entitySeoDescription(entity);
  return {
    title,
    description,
    alternates: { canonical: politicsDetailPath(entity.slug) },
    robots: { index: indexable, follow: true },
    openGraph: {
      title,
      description,
      url: `${SITE.url}${politicsDetailPath(entity.slug)}`,
      type: "article",
    },
  };
}

/**
 * Politics support detail: agency daily/weekly/monthly charts, survey method,
 * and related articles — moved off the board heatmap menus onto the entity page.
 */
export default async function PoliticsSupportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ name?: string; tf?: string }>;
}) {
  const { id: raw } = await params;
  const id = decodeRouteSlug(raw);
  if (RESERVED.has(id)) notFound();

  const query = searchParams ? await searchParams : {};
  const name = typeof query.name === "string" ? query.name : undefined;
  const entity = await loadEntity(id, name);
  if (!entity) notFound();

  if (entity.type !== "party_support" && entity.type !== "politician_support") {
    redirect(rankingPath(entity.slug) + (name ? `?name=${encodeURIComponent(name)}` : ""));
  }

  const initialTimeframe = parseTimeframeParam(query.tf) ?? "5m";
  const kind = entity.type === "party_support" ? "party" : "politician";
  const crumbs = breadcrumbJsonLd([
    { name: "KinDex", url: SITE.url },
    { name: "정치", url: `${SITE.url}/politics` },
    { name: entity.name, url: `${SITE.url}${politicsDetailPath(entity.slug)}` },
  ]);
  const dataset = entityDatasetJsonLd(
    entity,
    `${SITE.url}${politicsDetailPath(entity.slug)}`,
  );

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }}
      />
      <p className="text-sm text-muted">
        <Link href="/politics" className="hover:text-ink">
          정치 지수(INDEX)
        </Link>
        <span className="mx-2">/</span>
        {entity.name}
      </p>
      <EntityHero entity={entity} />
      <BuzzChart entity={entity} initialTimeframe={initialTimeframe} />
      <SupportIndexChart kind={kind} subject={entity.name} />
      <Suspense fallback={null}>
        <TodayAnalysisSlot id={id} name={name} />
      </Suspense>
      <Suspense fallback={null}>
        <RelatedBriefingLinks entity={entity} />
      </Suspense>
      <Suspense fallback={null}>
        <PollDeskSection entity={entity} />
      </Suspense>
      <Suspense fallback={null}>
        <RelatedSlot id={id} name={name} entity={entity} />
      </Suspense>
      <p className="text-xs text-muted">
        데이터 출처 · {SITE.name} 정치 데스크 · 리서치 기관별 일봉/주봉/월봉·조사 방식·관련 기사는 이 상세
        페이지에서 확인합니다.
      </p>
    </div>
  );
}

async function TodayAnalysisSlot({ id, name }: { id: string; name?: string }) {
  const analysis = await loadAnalysisArticle(id, name);
  if (!analysis?.article) return null;
  return <TodayAnalysis article={analysis.article} keyword={analysis.name} />;
}

async function RelatedSlot({
  id,
  name,
  entity,
}: {
  id: string;
  name?: string;
  entity: RankingEntity;
}) {
  const related = await loadRelated(id, name);
  return <RelatedRankingDesk entity={entity} related={related} />;
}
