import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuzzChart } from "@/components/entity/BuzzChart";
import { EntityHero } from "@/components/entity/EntityHero";
import { RelatedRankingDesk } from "@/components/entity/RelatedRankingDesk";
import { TodayAnalysis } from "@/components/entity/TodayAnalysis";
import { PollDeskSection } from "@/components/politics/PollDeskSection";
import { getOrCreateAnalysis } from "@/lib/analysis/pipeline";
import { getAllSlugs, getEntityBySlug, getRankings, getRelatedEntities } from "@/lib/api";
import { composeTodayAnalysis } from "@/lib/editorial/today-analysis";
import { formatRate } from "@/lib/format";
import { SITE } from "@/lib/site";
import { rankingPath, rankingUrl } from "@/lib/slugs";
import { parseTimeframeParam } from "@/lib/timeframes";
import type { EntityType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateStaticParams() {
  if (process.env.TRENDS_DATA_SOURCE === "live") return [];
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ name?: string; tf?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const entity = await getEntityBySlug(slug, typeof query.name === "string" ? query.name : undefined);
  if (!entity) return { title: "종목을 찾을 수 없습니다" };
  return {
    title: `${entity.name} ${entity.rank}위 · ${formatRate(entity.fluctuationRate)}`,
    description: entity.summary,
    alternates: { canonical: rankingPath(entity.slug) },
    openGraph: {
      title: `${entity.name} 버즈 시세`,
      description: entity.summary,
    },
  };
}

export default async function RankingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ name?: string; tf?: string }>;
}) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const entity = await getEntityBySlug(slug, typeof query.name === "string" ? query.name : undefined);
  if (!entity) notFound();
  const [related, market] = await Promise.all([getRelatedEntities(entity), getRankings()]);
  const initialTimeframe = parseTimeframeParam(query.tf) ?? "5m";
  let analysisArticle = composeTodayAnalysis({ entity, market, related });
  try {
    const analysis = await getOrCreateAnalysis({ entity, market, related });
    analysisArticle = analysis.entry.article;
  } catch {
    /* template article already prepared so the 오늘의 분석 block always renders */
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${entity.name} 버즈 시세`,
    url: rankingUrl(SITE.url, entity.slug),
    description: entity.summary,
    mainEntity: {
      "@type": schemaType(entity.type),
      name: entity.name,
      alternateName: entity.nameEn,
    },
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          지수(INDEX)
        </Link>
        <span className="mx-2">/</span>
        {entity.name}
      </p>
      <EntityHero entity={entity} />
      <BuzzChart entity={entity} initialTimeframe={initialTimeframe} />
      <TodayAnalysis article={analysisArticle} keyword={entity.name} />
      <PollDeskSection entity={entity} market={market} related={related} />
      <RelatedRankingDesk entity={entity} related={related} />
    </div>
  );
}

function schemaType(type: EntityType): string {
  if (type === "tv_show" || type === "tv_rating") return "TVSeries";
  if (type === "music_chart") return "MusicRecording";
  if (type === "webtoon") return "ComicSeries";
  if (type === "shorts") return "VideoObject";
  if (type === "mobile_game" || type === "pc_game" || type === "console_game") return "VideoGame";
  if (
    type === "headline_news" ||
    type === "political_search" ||
    type === "local_policy" ||
    type === "subsidy"
  ) {
    return "NewsArticle";
  }
  if (type === "party_support") return "Organization";
  if (type === "political_ratings") return "TVSeries";
  return "Person";
}
