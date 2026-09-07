import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import { BuzzChart } from "@/components/entity/BuzzChart";
import { EntityHeroLive } from "@/components/entity/EntityHeroLive";
import { MarketPriceChart } from "@/components/entity/MarketPriceChart";
import { RelatedRankingDesk } from "@/components/entity/RelatedRankingDesk";
import { TodayAnalysis } from "@/components/entity/TodayAnalysis";
import { PollDeskSection } from "@/components/politics/PollDeskSection";
import { SupportIndexChart } from "@/components/politics/SupportIndexChart";
import { getOrCreateAnalysis } from "@/lib/analysis/pipeline";
import { isGeminiAnalysis } from "@/lib/analysis/quality";
import { getAllSlugs, getEntityBySlug, getRankings, getRelatedEntities } from "@/lib/api";
import type { TodayAnalysisArticle } from "@/lib/editorial/today-analysis";
import { formatRate } from "@/lib/format";
import {
  enrichEntityWithCachedKospiQuote,
  entityNeedsLiveMarketQuote,
} from "@/lib/market/kospi-quotes";
import { resolveMarketChartInstrument } from "@/lib/market/naver-chart";
import { isNaverStockMeasurement } from "@/lib/market/naver-finance-format";
import { SITE } from "@/lib/site";
import { rankingPath, rankingUrl } from "@/lib/slugs";
import { parseTimeframeParam } from "@/lib/timeframes";
import { KinDexAboutSections } from "@/components/about/KinDexAboutSections";
import { channelFromLead } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import type { EntityType, RankingEntity } from "@/lib/types";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
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
  return {
    title: `${entity.name} · ${formatRate(rate)}`,
    description: isNaverStockMeasurement(entity.measurement)
      ? `${entity.name} 시세와 차트.`
      : entity.summary,
    alternates: { canonical: rankingPath(entity.slug) },
    robots: { index: false, follow: true },
    openGraph: {
      title: isNaverStockMeasurement(entity.measurement)
        ? `${entity.name} 시세`
        : `${entity.name} 버즈 시세`,
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
  const name = typeof query.name === "string" ? query.name : undefined;
  const entity = await loadEntity(slug, name);
  if (!entity) notFound();
  const initialTimeframe = parseTimeframeParam(query.tf) ?? "3m";
  const marketInstrument = resolveMarketChartInstrument(entity);
  const hydrateQuote = entityNeedsLiveMarketQuote(entity);
  const isMarketQuote = Boolean(
    marketInstrument && (isNaverStockMeasurement(entity.measurement) || hydrateQuote),
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: isMarketQuote ? `${entity.name} 시세` : `${entity.name} 버즈 시세`,
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
      <EntityHeroLive entity={entity} hydrateQuote={hydrateQuote} />
      {marketInstrument ? (
        <MarketPriceChart
          entity={entity}
          instrument={marketInstrument}
          initialTimeframe={initialTimeframe === "3m" ? "1d" : initialTimeframe}
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
        <PollDeskSlot entity={entity} />
      </Suspense>
      <Suspense fallback={null}>
        <RelatedSlot slug={slug} name={name} entity={entity} />
      </Suspense>
      <EntityAboutRail entity={entity} />
    </div>
  );
}

function aboutChannelForEntity(entity: RankingEntity): PostChannel {
  if (entity.sourceChannel) return entity.sourceChannel;
  const slug = entity.slug ?? "";
  if (
    slug.startsWith("food-restaurant") ||
    slug.startsWith("domestic-travel") ||
    slug.startsWith("overseas-travel") ||
    slug.startsWith("weekend-outing") ||
    slug.startsWith("travel-government")
  ) {
    return "travel";
  }
  return channelFromLead(entity, slug);
}

function EntityAboutRail({ entity }: { entity: RankingEntity }) {
  return (
    <aside className="rounded-2xl border border-line bg-panel px-5 py-6 md:px-8">
      <KinDexAboutSections channel={aboutChannelForEntity(entity)} compact />
    </aside>
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
