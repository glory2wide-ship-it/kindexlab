import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import { BuzzChart } from "@/components/entity/BuzzChart";
import { EntityHeroLive } from "@/components/entity/EntityHeroLive";
import {
  ItemDetailCategoryInfo,
  ItemDetailCategoryInfoSkeleton,
} from "@/components/entity/ItemDetailCategoryInfo";
import { TvProgramInfoCard } from "@/components/entity/TvProgramInfoCard";
import { MarketPriceChart } from "@/components/entity/MarketPriceChart";
import { RelatedBriefingLinks } from "@/components/entity/RelatedBriefingLinks";
import { RelatedRankingDesk } from "@/components/entity/RelatedRankingDesk";
import { TodayAnalysis } from "@/components/entity/TodayAnalysis";
import { PollDeskSection } from "@/components/politics/PollDeskSection";
import { SupportIndexChart } from "@/components/politics/SupportIndexChart";
import { SetActiveChannel } from "@/components/providers/ActiveChannelProvider";
import { getOrCreateAnalysis } from "@/lib/analysis/pipeline";
import { isGeminiAnalysis } from "@/lib/analysis/quality";
import { readAnalysis } from "@/lib/analysis/store";
import { getAllSlugs, getEntityBySlug, getRankings, getRelatedEntities } from "@/lib/api";
import type { TodayAnalysisArticle } from "@/lib/editorial/today-analysis";
import { formatRate } from "@/lib/format";
import {
  enrichEntityWithCachedKospiQuote,
  entityNeedsLiveMarketQuote,
} from "@/lib/market/kospi-quotes";
import { resolveMarketChartInstrument } from "@/lib/market/naver-chart";
import { isNaverStockMeasurement } from "@/lib/market/naver-finance-format";
import { channelFromLead, getPostChannel } from "@/lib/posts/channels";
import {
  breadcrumbJsonLd,
  entityDatasetJsonLd,
  entitySeoDescription,
  entitySeoTitle,
  isIndexableEntityPage,
} from "@/lib/seo/indexable-entity";
import { SITE } from "@/lib/site";
import { rankingPath, rankingUrl } from "@/lib/slugs";
import { parseTimeframeParam } from "@/lib/timeframes";
import type { EntityType, RankingEntity } from "@/lib/types";

export const dynamicParams = true;
/** Live tape resolution uses request-time data; keep on-demand rendering available. */
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  // Still listed for route discovery; live mode skips prerender.
  if (process.env.TRENDS_DATA_SOURCE === "live") return [];
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

/** Critical path for heatmap clicks: board-cache entity + cached quote only. */
const loadEntity = cache(async (slug: string, name?: string) => {
  const resolved = await getEntityBySlug(slug, name);
  if (!resolved) return null;
  return enrichEntityWithCachedKospiQuote(resolved);
});

const loadRelated = cache(async (slug: string, name?: string) => {
  const entity = await loadEntity(slug, name);
  if (!entity) return [] as RankingEntity[];
  return getRelatedEntities(entity);
});

const loadAnalysisArticle = cache(async (slug: string, name?: string) => {
  const entity = await loadEntity(slug, name);
  if (!entity) return null;

  let article: TodayAnalysisArticle | undefined;
  try {
    // Board heatmap rows resolve without the live tape — don't block analysis
    // streaming on getRankings() for the common detail click path.
    const related = await loadRelated(slug, name);
    const market = slug.includes("--")
      ? ({
          updatedAt: new Date().toISOString(),
          status: "open" as const,
          indices: [],
          items: [],
        } as Awaited<ReturnType<typeof getRankings>>)
      : await getRankings();
    const analysis = await getOrCreateAnalysis({ entity, market, related });
    if (analysis.entry && isGeminiAnalysis(analysis.entry)) article = analysis.entry.article;
  } catch {
    /* leave the block out; the data sections below stand on their own */
  }

  return { article, name: entity.name };
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ name?: string; tf?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const entity = await loadEntity(slug, typeof query.name === "string" ? query.name : undefined);
  if (!entity) return { title: "종목을 찾을 수 없습니다" };

  const rate = isNaverStockMeasurement(entity.measurement)
    ? entity.measurement.changeRate
    : entity.fluctuationRate;
  const analysis = await readAnalysis(entity.slug);
  const indexable = isIndexableEntityPage(entity, analysis);
  const title = isNaverStockMeasurement(entity.measurement)
    ? `${entity.name} 시세 · ${formatRate(rate)}`
    : entitySeoTitle(entity);
  const description = isNaverStockMeasurement(entity.measurement)
    ? `${entity.name} 시세와 차트.`
    : entitySeoDescription(entity);
  return {
    title,
    description,
    alternates: { canonical: rankingPath(entity.slug) },
    robots: { index: indexable, follow: true },
    openGraph: {
      title,
      description,
      url: rankingUrl(SITE.url, entity.slug),
      type: "article",
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
  const name = typeof query.name === "string" ? query.name : undefined;
  const entity = await loadEntity(slug, name);
  if (!entity) notFound();
  const initialTimeframe = parseTimeframeParam(query.tf) ?? "5m";
  const marketInstrument = resolveMarketChartInstrument(entity);
  const hydrateQuote = entityNeedsLiveMarketQuote(entity);
  const isMarketQuote = Boolean(
    marketInstrument && (isNaverStockMeasurement(entity.measurement) || hydrateQuote),
  );

  const channelId = entity.sourceChannel ?? channelFromLead(entity, entity.slug);
  const channelMeta = getPostChannel(channelId);
  const pageName = isMarketQuote ? `${entity.name} 시세` : entitySeoTitle(entity);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: pageName,
    url: rankingUrl(SITE.url, entity.slug),
    description: entitySeoDescription(entity),
    mainEntity: {
      "@type": schemaType(entity.type),
      name: entity.name,
      alternateName: entity.nameEn,
    },
  };
  const crumbs = breadcrumbJsonLd([
    { name: "KinDex", url: SITE.url },
    { name: channelMeta.label, url: `${SITE.url}${channelMeta.href}` },
    { name: entity.name, url: rankingUrl(SITE.url, entity.slug) },
  ]);
  const dataset = entityDatasetJsonLd(entity, rankingUrl(SITE.url, entity.slug));

  return (
    <div className="space-y-8">
      <SetActiveChannel channel={channelId} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }}
      />
      <p className="text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          지수(INDEX)
        </Link>
        <span className="mx-2">/</span>
        <Link href={channelMeta.href} className="hover:text-ink">
          {channelMeta.label}
        </Link>
        <span className="mx-2">/</span>
        {entity.name}
      </p>
      <EntityHeroLive entity={entity} hydrateQuote={hydrateQuote} />
      <TvProgramInfoCard entity={entity} />
      <Suspense fallback={<ItemDetailCategoryInfoSkeleton />}>
        <ItemDetailCategoryInfo entity={entity} />
      </Suspense>
      {marketInstrument ? (
        <MarketPriceChart
          entity={entity}
          instrument={marketInstrument}
          initialTimeframe={initialTimeframe === "5m" || initialTimeframe === "3m" ? "1d" : initialTimeframe}
        />
      ) : (
        <BuzzChart entity={entity} initialTimeframe={initialTimeframe} />
      )}
      {entity.type === "party_support" ? (
        <SupportIndexChart kind="party" subject={entity.name} />
      ) : null}
      {entity.type === "politician_support" ? (
        <SupportIndexChart kind="politician" subject={entity.name} />
      ) : null}
      <Suspense fallback={null}>
        <TodayAnalysisSlot slug={slug} name={name} />
      </Suspense>
      <Suspense fallback={null}>
        <RelatedBriefingLinks entity={entity} />
      </Suspense>
      <Suspense fallback={null}>
        <PollDeskSlot entity={entity} />
      </Suspense>
      <Suspense fallback={null}>
        <RelatedSlot slug={slug} name={name} entity={entity} />
      </Suspense>
    </div>
  );
}

async function TodayAnalysisSlot({ slug, name }: { slug: string; name?: string }) {
  const analysis = await loadAnalysisArticle(slug, name);
  if (!analysis?.article) return null;
  const { bodyMarkdown: _md, jsonLd: _ld, ...article } = analysis.article;
  return <TodayAnalysis article={article} keyword={analysis.name} />;
}

async function PollDeskSlot({ entity }: { entity: RankingEntity }) {
  return <PollDeskSection entity={entity} />;
}

async function RelatedSlot({
  slug,
  name,
  entity,
}: {
  slug: string;
  name?: string;
  entity: RankingEntity;
}) {
  const related = await loadRelated(slug, name);
  return <RelatedRankingDesk entity={entity} related={related} />;
}

function schemaType(type: EntityType): string {
  if (type === "tv_show" || type === "tv_rating") return "TVSeries";
  if (type === "music_chart") return "MusicRecording";
  if (type === "movie") return "Movie";
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
  if (type === "politician_support") return "Person";
  if (type === "political_ratings") return "TVSeries";
  return "Person";
}
