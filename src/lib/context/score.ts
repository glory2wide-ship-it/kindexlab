import type { ContextSource, SignalFact } from "@/lib/context/types";

/** Minimum weighted score before the LLM chain may run. */
export const MIN_CONTEXT_SCORE = 6;

/** News thin enough to trigger Tier 2 fallback collectors. */
export const NEWS_FALLBACK_THRESHOLD = 2;

export function scoreSignalFacts(facts: SignalFact[]): number {
  return facts.length * 2;
}

export function scoreSource(source: ContextSource): number {
  if (source.tier === "news") return 3;
  if (source.tier === "web") return 1;
  if (source.tier === "youtube") return 1;
  return 0;
}

export function computeContextScore(signalFacts: SignalFact[], sources: ContextSource[]): number {
  return scoreSignalFacts(signalFacts) + sources.reduce((sum, source) => sum + scoreSource(source), 0);
}

export function canGenerateContext(ctx: { score: number; sources: { url: string }[] }): boolean {
  return ctx.score >= MIN_CONTEXT_SCORE && ctx.sources.length >= 1;
}
