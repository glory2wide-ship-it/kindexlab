/**
 * Today's Analysis no longer uses a multi-step draft chain.
 * Generation goes through `generatePremiumArticle({ briefing: true })` with the
 * same `STATIC_SYSTEM_PROMPT` + `buildSinglePassUserPrompt` as 일일 브리핑.
 *
 * Kept only for type compatibility with the editor cliché strip helpers.
 */
export interface ColumnDraft {
  title: string;
  excerpt: string;
  sections: import("@/lib/editorial/today-analysis").TodayAnalysisSection[];
}

/** @deprecated Legacy floor — briefing single-pass targets 1,400~1,800자. */
export const MIN_DRAFT_CHARS = 480;
