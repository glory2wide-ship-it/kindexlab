/**
 * Keep the entity-detail 「오늘의 분석」 slot filled whenever possible.
 *
 * Priority:
 * 1. Live / prior Gemini·import analysis for this entity (incl. slug aliases)
 * 2. Related analysis for a strongly overlapping keyword
 * 3. Related 투데이 인사이트 (deep-dive) / 투데이 브리핑 (main)
 * 4. Legacy insight magazine / 이슈 칼럼 posts
 *
 * Fallbacks are presentation-only — never written into analysis_cache —
 * so the next successful Gemini generation replaces them cleanly.
 */

import {
  getOrCreateAnalysis,
  type AnalysisResult,
} from "@/lib/analysis/pipeline";
import {
  analysisEntryMatchesEntity,
  hasUsableAnalysisBody,
  isReusableAnalysis,
  listAnalysis,
  normalizeAnalysisMatchKey,
  readAnalysisForEntity,
  remountAnalysisForEntity,
  type CachedAnalysis,
} from "@/lib/analysis/store";
import { analysisPlainText, type TodayAnalysisArticle } from "@/lib/editorial/today-analysis";
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import {
  channelFromEntityType,
} from "@/lib/posts/channels";
import { listPostsByChannel } from "@/lib/posts/store";
import type { GeneratedPost, PostTable } from "@/lib/posts/types";
import {
  relatedBriefingsForEntity,
} from "@/lib/seo/related-briefings";
import { rankingPath } from "@/lib/slugs";
import type { BriefingArticle, RankingEntity, RankingsPayload } from "@/lib/types";

export type AnalysisSlotSource =
  | "analysis"
  | "prior-analysis"
  | "related-analysis"
  | "insight"
  | "briefing"
  | "magazine";

export type AnalysisSlotContent = {
  article: TodayAnalysisArticle;
  keyword: string;
  source: AnalysisSlotSource;
  /** Short reader-facing note under the 「오늘의 분석」 label. */
  sourceNote?: string;
};

const EMPTY_TABLE: PostTable = { caption: "", headers: [], rows: [] };

const SOURCE_NOTE: Record<AnalysisSlotSource, string | undefined> = {
  analysis: undefined,
  "prior-analysis": "이전에 생성된 분석 · 새 글이 나오면 자동 교체됩니다",
  "related-analysis": "관련 종목 분석 · 이 종목 전용 글이 생성되면 교체됩니다",
  insight: "관련 투데이 인사이트 · 이 종목 전용 분석이 생성되면 교체됩니다",
  briefing: "관련 투데이 브리핑 · 이 종목 전용 분석이 생성되면 교체됩니다",
  magazine: "관련 인사이트 매거진 · 이 종목 전용 분석이 생성되면 교체됩니다",
};

function entityChannel(entity: RankingEntity) {
  return entity.sourceChannel ?? channelFromEntityType(entity.type);
}

function stripPresentationFields(article: TodayAnalysisArticle): TodayAnalysisArticle {
  const { bodyMarkdown: _md, jsonLd: _ld, ...rest } = article;
  return rest;
}

function fromCached(
  entry: CachedAnalysis,
  entity: RankingEntity,
  source: AnalysisSlotSource,
): AnalysisSlotContent {
  const remounted = remountAnalysisForEntity(entry, entity.slug, entity.name);
  return {
    article: stripPresentationFields(remounted.article),
    keyword: entity.name,
    source,
    sourceNote: SOURCE_NOTE[source],
  };
}

function scoreRelatedAnalysis(entry: CachedAnalysis, entity: RankingEntity): number {
  const name = entity.name.trim();
  const nameKey = normalizeAnalysisMatchKey(name);
  const keyword = (entry.keyword || entry.article?.focusKeyword || "").trim();
  const keywordKey = normalizeAnalysisMatchKey(keyword);
  let score = 0;
  if (nameKey && keywordKey) {
    if (nameKey === keywordKey) score += 20;
    else if (nameKey.length >= 4 && keywordKey.includes(nameKey)) score += 10;
    else if (keywordKey.length >= 4 && nameKey.includes(keywordKey)) score += 8;
  }
  if (namesOverlap(name, keyword)) score += 6;
  const blob = `${entry.article?.title ?? ""} ${entry.article?.excerpt ?? ""}`;
  if (blob.includes(name) || namesOverlap(blob, name)) score += 5;
  if (entry.article?.entitySlug === entity.slug) score += 12;
  return score;
}

async function findRelatedAnalysis(
  entity: RankingEntity,
  related: RankingEntity[] = [],
): Promise<CachedAnalysis | undefined> {
  // Prefer columns already written for heatmap neighbours / constituents.
  for (const neighbour of related) {
    if (!neighbour?.slug || neighbour.slug === entity.slug) continue;
    try {
      const entry = await readAnalysisForEntity(neighbour.slug, neighbour.name);
      if (entry && isReusableAnalysis(entry)) return entry;
    } catch {
      /* soft */
    }
  }

  const rows = await listAnalysis();
  let best: CachedAnalysis | undefined;
  let bestScore = 0;
  for (const entry of rows) {
    if (!isReusableAnalysis(entry)) continue;
    // Exact-entity priors belong to priority 1 — skip here.
    if (analysisEntryMatchesEntity(entry, entity.slug, entity.name)) continue;
    const score = scoreRelatedAnalysis(entry, entity);
    if (score < 8) continue;
    const generated = Date.parse(entry.generatedAt || "") || 0;
    const weighted = score * 1e15 + generated;
    if (!best || weighted > bestScore) {
      best = entry;
      bestScore = weighted;
    }
  }
  return best;
}

function briefingToTodayAnalysis(
  article: BriefingArticle,
  entity: RankingEntity,
): TodayAnalysisArticle {
  const sections = (article.sections ?? [])
    .map((section) => ({
      heading: section.heading?.trim() || "핵심 요약",
      headingLevel: (section.headingLevel === 3 ? 3 : 2) as 2 | 3,
      paragraphs: (section.paragraphs ?? []).map((p) => p.trim()).filter(Boolean),
    }))
    .filter((section) => section.paragraphs.length > 0);

  if (!sections.length && article.excerpt?.trim()) {
    sections.push({
      heading: "핵심 요약",
      headingLevel: 2,
      paragraphs: [article.excerpt.trim()],
    });
  }

  const table: PostTable = article.table?.headers?.length
    ? {
        caption: article.table.caption || "관련 브리핑 요약",
        headers: article.table.headers,
        rows: article.table.rows,
        markdown: article.table.markdown,
        html: article.table.html,
      }
    : EMPTY_TABLE;

  const faq = (article.faq ?? []).map((item) => ({
    question: item.question,
    answer: item.answer,
  }));

  const draft: TodayAnalysisArticle = {
    id: `fallback-briefing-${article.slug}-${entity.slug}`,
    slug: `${article.editionDate}-${entity.slug}-related`,
    entitySlug: entity.slug,
    title: article.title,
    excerpt: article.excerpt || `${entity.name} 관련 투데이 브리핑입니다.`,
    editionDate: article.editionDate,
    publishedAt: article.publishedAt,
    characterCount: 0,
    readingMinutes: article.readingMinutes || 3,
    focusKeyword: article.focusKeyword || entity.name,
    supportKeyword: article.supportKeyword || entity.name,
    sections,
    table,
    faq,
    externalLink: article.externalLink ?? {
      href: `/briefing/${article.slug}`,
      label: "원문 브리핑 보기",
    },
    internalLink: article.internalLink ?? {
      href: rankingPath(entity.slug),
      label: `${entity.name} 지수(INDEX)`,
    },
    reviewed: false,
  };
  draft.characterCount = analysisPlainText(draft).replace(/\s+/g, "").length;
  return draft;
}

function postToTodayAnalysis(post: GeneratedPost, entity: RankingEntity): TodayAnalysisArticle {
  const sections = (post.sections ?? [])
    .map((section) => ({
      heading: section.heading?.trim() || "핵심 요약",
      headingLevel: (section.headingLevel === 3 ? 3 : 2) as 2 | 3,
      paragraphs: (section.paragraphs ?? []).map((p) => p.trim()).filter(Boolean),
    }))
    .filter((section) => section.paragraphs.length > 0);

  const draft: TodayAnalysisArticle = {
    id: `fallback-post-${post.slug}-${entity.slug}`,
    slug: `${post.editionDate}-${entity.slug}-magazine`,
    entitySlug: entity.slug,
    title: post.title,
    excerpt: post.excerpt || `${entity.name} 관련 인사이트입니다.`,
    editionDate: post.editionDate,
    publishedAt: post.publishedAt,
    characterCount: post.characterCount || 0,
    readingMinutes: post.readingMinutes || 3,
    focusKeyword: post.focusKeyword || entity.name,
    supportKeyword: post.supportKeyword || entity.name,
    sections,
    table: post.table?.headers?.length ? post.table : EMPTY_TABLE,
    faq: post.faq ?? [],
    externalLink: post.externalLink ?? {
      href: `/${post.channel}/${encodeURIComponent(post.slug)}`,
      label: "원문 칼럼 보기",
    },
    internalLink: post.internalLink ?? {
      href: rankingPath(entity.slug),
      label: `${entity.name} 지수(INDEX)`,
    },
    reviewed: false,
  };
  if (!draft.characterCount) {
    draft.characterCount = analysisPlainText(draft).replace(/\s+/g, "").length;
  }
  return draft;
}

function scorePost(post: GeneratedPost, entity: RankingEntity): number {
  const name = entity.name.trim();
  const key = normalizeName(name);
  let score = 0;
  if (post.focusKeyword && namesOverlap(post.focusKeyword, name)) score += 10;
  if (post.supportKeyword && namesOverlap(post.supportKeyword, name)) score += 4;
  const blob = `${post.title} ${post.excerpt}`;
  if (blob.includes(name) || (key && normalizeName(blob).includes(key))) score += 8;
  return score;
}

async function findRelatedPost(entity: RankingEntity): Promise<GeneratedPost | undefined> {
  const posts = await listPostsByChannel(entityChannel(entity));
  let best: GeneratedPost | undefined;
  let bestScore = 0;
  for (const post of posts) {
    const score = scorePost(post, entity);
    // Keep a soft threshold for keyword match; last-resort uses any post below.
    if (score < 6) continue;
    const stamp = Date.parse(post.updatedAt || post.publishedAt || "") || 0;
    const weighted = score * 1e15 + stamp;
    if (!best || weighted > bestScore) {
      best = post;
      bestScore = weighted;
    }
  }
  if (best) return best;
  // Last resort: newest magazine column on the same channel so the slot stays filled.
  return posts
    .slice()
    .sort(
      (a, b) =>
        (Date.parse(b.updatedAt || b.publishedAt || "") || 0) -
        (Date.parse(a.updatedAt || a.publishedAt || "") || 0),
    )[0];
}

async function resolveEditorialFallback(
  entity: RankingEntity,
  relatedEntities: RankingEntity[] = [],
): Promise<AnalysisSlotContent | null> {
  const related = await findRelatedAnalysis(entity, relatedEntities);
  if (related && hasUsableAnalysisBody(related)) {
    return fromCached(related, entity, "related-analysis");
  }

  const briefings = await relatedBriefingsForEntity(entity, 8);
  const insight = briefings.find((item) => item.kind === "deep-dive");
  if (insight) {
    return {
      article: briefingToTodayAnalysis(insight, entity),
      keyword: entity.name,
      source: "insight",
      sourceNote: SOURCE_NOTE.insight,
    };
  }
  const briefing = briefings.find((item) => item.kind === "main") ?? briefings[0];
  if (briefing) {
    return {
      article: briefingToTodayAnalysis(briefing, entity),
      keyword: entity.name,
      source: "briefing",
      sourceNote: SOURCE_NOTE.briefing,
    };
  }

  const post = await findRelatedPost(entity);
  if (post) {
    return {
      article: postToTodayAnalysis(post, entity),
      keyword: entity.name,
      source: "magazine",
      sourceNote: SOURCE_NOTE.magazine,
    };
  }

  return null;
}

/**
 * Resolve display content for the 오늘의 분석 slot.
 * Always queues Gemini via getOrCreateAnalysis when missing; editorial
 * fallbacks fill the UI until that write lands.
 */
export async function resolveTodayAnalysisSlot(options: {
  entity: RankingEntity;
  market: RankingsPayload;
  related?: RankingEntity[];
}): Promise<AnalysisSlotContent | null> {
  const { entity, market, related } = options;

  let pipeline: AnalysisResult | null = null;
  try {
    pipeline = await getOrCreateAnalysis({ entity, market, related });
  } catch {
    pipeline = null;
  }

  if (pipeline?.entry && isReusableAnalysis(pipeline.entry)) {
    const noteSource: AnalysisSlotSource =
      pipeline.cache === "hit" ? "analysis" : "prior-analysis";
    return {
      article: stripPresentationFields(pipeline.entry.article),
      keyword: entity.name,
      source: noteSource,
      sourceNote: SOURCE_NOTE[noteSource],
    };
  }

  // Belt: alias prior even if pipeline remount raced.
  try {
    const prior = await readAnalysisForEntity(entity.slug, entity.name);
    if (prior && isReusableAnalysis(prior)) {
      const remounted = remountAnalysisForEntity(prior, entity.slug, entity.name);
      return {
        article: stripPresentationFields(remounted.article),
        keyword: entity.name,
        source: "prior-analysis",
        sourceNote: SOURCE_NOTE["prior-analysis"],
      };
    }
  } catch {
    /* soft */
  }

  try {
    return await resolveEditorialFallback(entity, related ?? []);
  } catch {
    return null;
  }
}
