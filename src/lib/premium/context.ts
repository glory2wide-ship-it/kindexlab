import { collectArticleContext, renderContextBlock } from "@/lib/context/collect-context";
import { canGenerateContext, MIN_CONTEXT_SCORE } from "@/lib/context/score";
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
}

/** @deprecated Use MIN_CONTEXT_SCORE + canGenerateContext instead. */
export const MIN_PREMIUM_SOURCES = 2;

export { MIN_CONTEXT_SCORE, canGenerateContext };

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
 * Uses the 4-tier hybrid collector (signal → news → web/youtube → intent).
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
  return {
    keyword: ctx.keyword,
    sources: toPremiumSources(ctx.sources),
    providers: ctx.providers,
    block: ctx.block,
    unwrapped: ctx.unwrapped,
    lookbackHours: ctx.lookbackHours,
    score: ctx.score,
    signalFacts: ctx.signalFacts.map((fact) => fact.text),
    intentHints: ctx.intentHints,
  };
}

export { renderContextBlock };

/** True when the href exactly matches one of the retrieved articles. */
export function isRetrievedUrl(href: string, sources: PremiumSource[]): boolean {
  return sources.some((source) => source.url === href);
}
