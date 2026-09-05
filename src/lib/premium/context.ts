import { collectArticleContext, renderContextBlock } from "@/lib/context/collect-context";
import {
  canGenerateContext,
  countNewsSources,
  MIN_CONTEXT_SCORE,
  NEWS_FALLBACK_THRESHOLD,
} from "@/lib/context/score";
import type { ContextSource } from "@/lib/context/types";
import type { RankingEntity } from "@/lib/types";

/**
 * A retrieved article that carries a resolvable URL. The premium prompt is
 * allowed to cite exactly these, which is what keeps invented links out of the
 * published body: anything the model returns is checked against this set.
 */
export interface PremiumSource {
  title: string;
  url: string;
  publisher: string;
  publishedAt?: string;
  snippet?: string;
  tier: ContextSource["tier"];
}

export interface PremiumContext {
  keyword: string;
  sources: PremiumSource[];
  /** Providers that actually answered, for the rebuild report. */
  providers: string[];
  /** The block injected into the user message. */
  block: string;
  /** How many aggregator handles were resolved to publisher URLs, and how many were dropped. */
  unwrapped: { resolved: number; failed: number };
  /** The retrieval window that produced these sources, in hours. */
  lookbackHours: number;
  /** Weighted coverage score (signal + news + fallback). */
  score: number;
  signalFacts: string[];
  intentHints: string[];
  /** True when news RSS/API returned at or below the fallback threshold. */
  newsThin: boolean;
  sourceTextChars: number;
  tierCounts: Partial<Record<ContextSource["tier"], number>>;
}

/** @deprecated Use MIN_CONTEXT_SCORE + canGenerateContext instead. */
export const MIN_PREMIUM_SOURCES = 2;

export { MIN_CONTEXT_SCORE, canGenerateContext };

/** News count at or below this triggers web/blog/youtube fallbacks. */
export { NEWS_FALLBACK_THRESHOLD };

export function isSparseContext(ctx: Pick<PremiumContext, "sources" | "newsThin" | "score">): boolean {
  return ctx.newsThin || ctx.sources.length <= 3 || ctx.score < MIN_CONTEXT_SCORE + 2;
}

/**
 * Extra user-message guidance when Tier 1 news is thin.
 * Structure-only hints — facts must still come from collected URLs and signal facts.
 */
export function buildSparseEnrichmentPrompt(
  ctx: PremiumContext,
  options?: { briefing?: boolean; minChars?: number; maxChars?: number },
): string {
  if (!isSparseContext(ctx)) return "";
  const minChars = options?.minChars ?? 1400;
  const maxChars = options?.maxChars ?? 1800;
  if (options?.briefing) {
    return [
      "[데이터 부족 모드 — 브리핑]",
      "수집 뉴스가 적습니다. 일반 웹문서, 네이버 블로그, 유튜브 설명란, 연관검색 의도를 함께 참고해 팩트→Why→How→전망(+표) 뼈대로 밀도 있게 쓰세요.",
      "대체 출처의 제목·요약·설명란에 있는 고유명사와 실제 URL만 근거로 사용하세요. 확인되지 않은 사실은 단정하지 마세요.",
      `${minChars}~${maxChars}자 구간을 패딩 없이 채우세요. 같은 명사를 반복해 분량을 채우지 마세요.`,
      `수집 현황: news=${ctx.tierCounts.news ?? 0}, web=${ctx.tierCounts.web ?? 0}, youtube=${ctx.tierCounts.youtube ?? 0}, sourceTextChars=${ctx.sourceTextChars}.`,
      ctx.intentHints.length
        ? `[참고 의도 — 사실 근거 아님]\n${ctx.intentHints.map((hint, index) => `${index + 1}. ${hint}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "[데이터 부족 모드 — 연관검색어·의도 기반 확장]",
    "수집된 뉴스 기사가 적습니다. 아래 연관검색 의도를 바탕으로 다음 구조로 공백 제외 2,000자 이상 작성하세요.",
    "1) 키워드 개요·팩트  2) Why(배경·원인)  3) How(독자 영향·활용)  4) 전망·파급  5) FAQ 3가지 + 비교 표",
    "연관검색어·의도 힌트는 소제목·FAQ 질문 설계에만 쓰고, 확인되지 않은 사실은 단정하지 마세요.",
    "'실행 체크리스트' 목록 섹션은 쓰지 마세요. How는 서술형 실용 요령으로만.",
    "제공된 [수집 자료] URL과 [실시간 신호]에 없는 수치·날짜·기관명은 쓰지 마세요.",
    "",
    "[연관검색·FAQ 의도]",
    ...ctx.intentHints.map((hint, index) => `${index + 1}. ${hint}`),
  ].join("\n");
}

function toPremiumSources(sources: ContextSource[]): PremiumSource[] {
  return sources.map((source) => ({
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    publishedAt: source.publishedAt,
    snippet: source.snippet,
    tier: source.tier,
  }));
}

/** Max links shown under “교차 확인 자료”. RAG may retrieve more for grounding. */
export const DISPLAY_SOURCE_LIMIT = 5;

/**
 * Picks a short, publisher-diverse cite list for the reader-facing source block.
 * Full retrieval stays available for URL validation and the LLM prompt.
 */
export function selectDisplaySources(
  sources: PremiumSource[],
  limit = DISPLAY_SOURCE_LIMIT,
): PremiumSource[] {
  if (sources.length <= limit) return sources;
  const ranked = [...sources].sort((left, right) => {
    const tierScore = (tier: PremiumSource["tier"]) => (tier === "news" ? 0 : tier === "web" ? 1 : 2);
    const byTier = tierScore(left.tier) - tierScore(right.tier);
    if (byTier !== 0) return byTier;
    return (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "");
  });
  const picked: PremiumSource[] = [];
  const seenPublishers = new Set<string>();
  for (const source of ranked) {
    const key = (source.publisher || source.url).trim().toLowerCase();
    if (key && seenPublishers.has(key)) continue;
    if (key) seenPublishers.add(key);
    picked.push(source);
    if (picked.length >= limit) return picked;
  }
  for (const source of ranked) {
    if (picked.some((item) => item.url === source.url)) continue;
    picked.push(source);
    if (picked.length >= limit) break;
  }
  return picked;
}

/**
 * Retrieves live coverage for one keyword and renders it as prompt context.
 *
 * Tier 0: Signal brief
 * Tier 1: News RSS/API (lookback ladder)
 * Tier 2: Naver blog/web + Serper web (when news ≤ 2)
 * Tier 3: YouTube metadata (when news ≤ 2 and web still thin)
 * Tier 4: Intent / sparse outline hints
 */
export async function collectPremiumContext(
  keyword: string,
  options: {
    limit?: number;
    lookbackHours?: number;
    entity?: RankingEntity;
    related?: RankingEntity[];
    relatedKeywords?: string[];
    asOfDate?: string;
  } = {},
): Promise<PremiumContext> {
  const ctx = await collectArticleContext(keyword, options);
  const sources = toPremiumSources(ctx.sources);
  return {
    keyword: ctx.keyword,
    sources,
    providers: ctx.providers,
    block: ctx.block,
    unwrapped: ctx.unwrapped,
    lookbackHours: ctx.lookbackHours,
    score: ctx.score,
    signalFacts: ctx.signalFacts.map((fact) => fact.text),
    intentHints: ctx.intentHints,
    newsThin: countNewsSources(ctx.sources) <= NEWS_FALLBACK_THRESHOLD,
    sourceTextChars: ctx.sourceTextChars,
    tierCounts: ctx.tierCounts,
  };
}

export { renderContextBlock };

/** True when the href exactly matches one of the retrieved articles. */
export function isRetrievedUrl(href: string, sources: PremiumSource[]): boolean {
  return sources.some((source) => source.url === href);
}
