import { getBoard } from "@/lib/boards/registry";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Today's Analysis always uses the same Gemini prompts as 일일 브리핑 /
 * Update 키워드 (`STATIC_SYSTEM_PROMPT` + `buildSinglePassUserPrompt`).
 * Board-slug gating was removed — every heatmap detail column shares that path.
 */

/** @deprecated All boards use briefing prompts; kept for script compatibility. */
export const BRIEFING_PROMPT_BOARD_SLUGS = [
  "governor-approval-index",
  "government-support-fund",
  "policy-controversy-index",
  "government-subsidy-search",
  "culture-leisure-grant-ranking",
  "travel-government-grant-ranking",
  "entertainment-government-grant-ranking",
] as const;

export type BriefingPromptBoardSlug = (typeof BRIEFING_PROMPT_BOARD_SLUGS)[number];

/** Extracts `{boardSlug}` from `boardSlug--row-slug` entity ids. */
export function boardSlugFromEntitySlug(entitySlug: string | undefined): string | undefined {
  if (!entitySlug) return undefined;
  const at = entitySlug.indexOf("--");
  if (at <= 0) return undefined;
  return entitySlug.slice(0, at);
}

/** Always true — Today's Analysis shares briefing prompts site-wide. */
export function usesBriefingAnalysisPrompt(_entitySlug?: string): boolean {
  return true;
}

export function analysisPromptChannel(entitySlug: string | undefined): PostChannel | undefined {
  const boardSlug = boardSlugFromEntitySlug(entitySlug);
  if (!boardSlug) return undefined;
  return getBoard(boardSlug)?.channel;
}
