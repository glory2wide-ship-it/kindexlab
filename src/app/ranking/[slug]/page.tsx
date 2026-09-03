import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BuzzChart } from "@/components/entity/BuzzChart";
import { EntityHero } from "@/components/entity/EntityHero";
import { RelatedRankingDesk } from "@/components/entity/RelatedRankingDesk";
import { TodayAnalysis } from "@/components/entity/TodayAnalysis";
import { PollDeskSection } from "@/components/politics/PollDeskSection";
import { SupportIndexChart } from "@/components/politics/SupportIndexChart";
import { getOrCreateAnalysis } from "@/lib/analysis/pipeline";
import { getAllSlugs, getEntityBySlug, getRankings, getRelatedEntities } from "@/lib/api";
import type { TodayAnalysisArticle } from "@/lib/editorial/today-analysis";
import { formatRate } from "@/lib/format";
import { SITE } from "@/lib/site";
import { rankingPath, rankingUrl } from "@/lib/slugs";
import { parseTimeframeParam } from "@/lib/timeframes";
import type { EntityType } from "@/lib/types";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  if (process.env.TRENDS_DATA_SOURCE === "live") return [];
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

/**
 * Builds the whole detail view once per request.
 *
 * `generateMetadata` needs the column's provenance to decide whether the page
 * may be indexed, and the body needs the column itself. Both used to resolve
 * the entity and the rankings payload independently, which also meant two
 * chances to start the analysis pipeline for one slug.
 */
const loadDetail = cache(async (slug: string, name?: string) => {
  const entity = await getEntityBySlug(slug, name);
  if (!entity) return null;

  const [related, market] = await Promise.all([getRelatedEntities(entity), getRankings()]);

  // Only a news-grounded column is worth printing. The deterministic composer
  // fills one skeleton per keyword — the same sentences, the same FAQ answers,
  // the subject's name dropped into the slots — and noindex only hides that from
  // the crawler, not from a reader who clicks through from the heatmap. Dropping
  // the block leaves the index card, the buzz chart and the related rail, all of
  // which are measured data rather than prose written around an empty middle.
  let article: TodayAnalysisArticle | undefined;
  try {
    const analysis = await getOrCreateAnalysis({ entity, market, related });
    if (analysis.entry.provenance.kind === "chain") article = analysis.entry.article;
  } catch {
    /* leave the block out; the data sections below stand on their own */
  }

  return { entity, related, market, article, grounded: Boolean(article) };
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
  const detail = await loadDetail(slug, typeof query.name === "string" ? query.name : undefined);
  if (!detail) return { title: "종목을 찾을 수 없습니다" };
  const { entity, grounded } = detail;

  return {
    title: `${entity.name} ${entity.rank}위 · ${formatRate(entity.fluctuationRate)}`,
    description: entity.summary,
    alternates: { canonical: rankingPath(entity.slug) },
    // A template column is the same skeleton with the keyword swapped in, so a
    // few hundred of them read as scaled low-value content no matter how the
    // individual page looks. Those stay out of the index until the chain finds
    // enough reporting to ground them; `follow` keeps the board links crawlable
    // so the columns that are grounded still get discovered through here.
    robots: grounded ? undefined : { index: false, follow: true },
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
  const detail = await loadDetail(slug, typeof query.name === "string" ? query.name : undefined);
  if (!detail) notFound();
  const { entity, related, market, article: analysisArticle } = detail;
  const initialTimeframe = parseTimeframeParam(query.tf) ?? "5m";

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
      {entity.type === "party_support" ? (
        <SupportIndexChart kind="party" subject={entity.name} />
      ) : null}
      {entity.type === "politician_support" ? (
        <SupportIndexChart kind="politician" subject={entity.name} />
      ) : null}
      {analysisArticle ? <TodayAnalysis article={analysisArticle} keyword={entity.name} /> : null}
      <PollDeskSection entity={entity} market={market} related={related} />
      <RelatedRankingDesk entity={entity} related={related} />
    </div>
  );
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
