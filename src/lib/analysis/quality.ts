import type { CachedAnalysis } from "@/lib/analysis/store";

/**
 * Heatmap "오늘의 분석" columns ship only when Gemini produced them.
 * Deterministic `composeTodayAnalysis` templates must never reach readers.
 */
export function isGeminiAnalysis(
  entry: Pick<CachedAnalysis, "provenance"> | null | undefined,
): boolean {
  return entry?.provenance.kind === "chain";
}
