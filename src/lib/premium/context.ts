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
export function buildSparseEnrichmentPrompt(ctx: PremiumContext, options?: { briefing?: boolean }): string {
  if (!isSparseContext(ctx)) return "";
  if (options?.briefing) {
    return [
      "[데이터 부족 모드 — 브리핑]",
      "수집 뉴스가 적습니다. 억지 분량·체크리스트 패딩 대신 팩트→Why→How→전망(+표) 뼈대로 밀도 있게 쓰세요.",
      "확인되지 않은 사실은 단정하지 마세요. 1,400~1,800자 구간을 패딩 없이 채우세요.",
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
  };
}

export { renderContextBlock };

/** True when the href exactly matches one of the retrieved articles. */
export function isRetrievedUrl(href: string, sources: PremiumSource[]): boolean {
  return sources.some((source) => source.url === href);
}
