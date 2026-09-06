import type { ContextSource, SignalFact } from "@/lib/context/types";

/** Minimum weighted score before the LLM chain may run. */
export const MIN_CONTEXT_SCORE = 6;

/** News thin enough to trigger Tier 2 fallback collectors. */
export const NEWS_FALLBACK_THRESHOLD = 2;

export function scoreSignalFacts(facts: SignalFact[]): number {
  return facts.length * 2;
}

export function countNewsSources(sources: ContextSource[]): number {
  return sources.filter((source) => source.tier === "news").length;
}

export function scoreSource(source: ContextSource, newsThin = false): number {
  if (source.tier === "news") return 3;
  if (source.tier === "web") return newsThin ? 2 : 1;
  if (source.tier === "youtube") return newsThin ? 2 : 1;
  return 0;
}

export function computeContextScore(signalFacts: SignalFact[], sources: ContextSource[]): number {
  const newsThin = countNewsSources(sources) <= NEWS_FALLBACK_THRESHOLD;
  return (
    scoreSignalFacts(signalFacts) +
    sources.reduce((sum, source) => sum + scoreSource(source, newsThin), 0)
  );
}

export function canGenerateContext(ctx: {
  score: number;
  sources: { url: string; tier?: ContextSource["tier"]; snippet?: string }[];
  sourceTextChars?: number;
}): boolean {
  if (!ctx.sources.length) return false;
  if (ctx.score >= MIN_CONTEXT_SCORE) return true;
  const newsCount = ctx.sources.filter((source) => source.tier === "news").length;
  const citable = ctx.sources.filter((source) => source.url);
  const webLike = ctx.sources.filter((source) => source.tier === "web" || source.tier === "youtube");
  const snippetChars =
    ctx.sourceTextChars ??
    ctx.sources.reduce((sum, source) => sum + (source.snippet?.replace(/\s+/g, "").length ?? 0), 0);
  // News-less keywords may still clear the bar with web/blog/youtube fallbacks.
  if (newsCount <= NEWS_FALLBACK_THRESHOLD && citable.length >= 2 && ctx.score >= 4) {
    return true;
  }
  // Multi-source fallback mode: enough citable web/video evidence plus usable text.
  if (newsCount === 0 && webLike.length >= 3 && citable.length >= 3 && snippetChars >= 240) {
    return true;
  }
  return false;
}
