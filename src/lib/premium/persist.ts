import { editionDateTime, kstDateString } from "@/lib/briefing/dates";
import type { TodayAnalysisArticle } from "@/lib/editorial/today-analysis";
import type { PremiumArticle } from "@/lib/premium/generate";
import { persistGeneratedPost } from "@/lib/posts/store";
import type { GeneratedPost, PostChannel, PostSlot } from "@/lib/posts/types";
import { analysisTtlHours, writeAnalysis, type CachedAnalysis } from "@/lib/analysis/store";

function readingMinutes(characterCount: number): number {
  return Math.max(2, Math.round(characterCount / 500));
}

function slotForHour(hour: number): PostSlot {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function toAnalysisArticle(
  article: PremiumArticle,
  options: { channel: PostChannel; editionDate: string; publishedAt: string },
): TodayAnalysisArticle {
  return {
    id: `premium-${article.slug}-${options.editionDate}`,
    slug: `${options.editionDate}-${article.slug}`,
    entitySlug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    editionDate: options.editionDate,
    publishedAt: options.publishedAt,
    characterCount: article.characterCount,
    readingMinutes: readingMinutes(article.characterCount),
    focusKeyword: article.keyword,
    supportKeyword: article.takeaways[0] ?? article.keyword,
    sections: article.sections,
    table: article.table,
    faq: article.faq,
    externalLink: article.externalLink,
    internalLink: article.internalLink,
    reviewed: true,
    bodyMarkdown: article.bodyMarkdown,
    jsonLd: article.jsonLd,
    sources: article.sources.map((source) => ({
      title: source.title,
      url: source.url,
      publisher: source.publisher,
      publishedAt: source.publishedAt,
    })),
  };
}

function toGeneratedPost(
  article: PremiumArticle,
  analysis: TodayAnalysisArticle,
  options: { channel: PostChannel; editionDate: string; publishedAt: string },
): GeneratedPost {
  return {
    id: analysis.id,
    slug: analysis.slug,
    title: article.title,
    excerpt: article.excerpt,
    publishedAt: options.publishedAt,
    updatedAt: new Date().toISOString(),
    slot: slotForHour(new Date(options.publishedAt).getHours()),
    channel: options.channel,
    editionDate: options.editionDate,
    wordCount: article.bodyMarkdown.split(/\s+/).filter(Boolean).length,
    characterCount: article.characterCount,
    readingMinutes: analysis.readingMinutes,
    focusKeyword: article.keyword,
    supportKeyword: analysis.supportKeyword,
    table: article.table,
    faq: article.faq,
    externalLink: article.externalLink,
    internalLink: article.internalLink,
    sources: article.sources.map((source, index) => ({
      id: `src-${index + 1}`,
      label: source.publisher,
      ok: true,
      summary: source.title,
    })),
    sections: article.sections.map((section) => ({
      heading: section.heading,
      headingLevel: section.headingLevel,
      paragraphs: section.paragraphs,
    })),
  };
}

/**
 * Stores one premium column in both places a reader can reach it: the analysis
 * cache behind `/ranking/[slug]` (오늘의 분석) and the generated post list
 * (이슈칼럼). Writing both from one mapping keeps the two views of the same
 * article from drifting apart.
 */
export async function persistPremiumArticle(
  article: PremiumArticle,
  options: { channel: PostChannel; editionDate?: string },
): Promise<{ analysis: CachedAnalysis; post: GeneratedPost }> {
  const editionDate = options.editionDate ?? kstDateString();
  const publishedAt = editionDateTime(editionDate);
  const analysisArticle = toAnalysisArticle(article, {
    channel: options.channel,
    editionDate,
    publishedAt,
  });

  const generatedAt = new Date();
  const entry: CachedAnalysis = {
    slug: article.slug,
    keyword: article.keyword,
    editionDate,
    generatedAt: generatedAt.toISOString(),
    expiresAt: new Date(generatedAt.getTime() + analysisTtlHours() * 3600_000).toISOString(),
    article: analysisArticle,
    provenance: {
      kind: "chain",
      newsDocs: article.sources.length,
      publishers: [...new Set(article.sources.map((source) => source.publisher))].slice(0, 6),
      facts: article.sources.map((source) => source.title).slice(0, 6),
      model: article.model,
      buildMs: 0,
    },
  };

  const post = toGeneratedPost(article, analysisArticle, {
    channel: options.channel,
    editionDate,
    publishedAt,
  });

  await writeAnalysis(entry);
  await persistGeneratedPost(post);

  return { analysis: entry, post };
}
