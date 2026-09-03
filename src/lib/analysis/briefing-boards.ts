import { getBoard } from "@/lib/boards/registry";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Board heatmaps whose "오늘의 분석" columns use the daily-briefing editor
 * prompts instead of the default today-analysis editorial prompt.
 *
 * Matched by board slug prefix on entity slugs (`{boardSlug}--{name}`).
 */
export const BRIEFING_PROMPT_BOARD_SLUGS = [
  "governor-approval-index", // 정치 · 지자체 정책지수
  "government-support-fund", // 정치 · 정부 지원금
  "policy-controversy-index", // 정치 · 이슈 키워드
  "government-subsidy-search", // 경제 · 경제 정부지원금
  "culture-leisure-grant-ranking", // 문화/생활 · 문화/생활 정부 지원금
  "travel-government-grant-ranking", // 여행/맛집 · 여행 정부지원금
] as const;

export type BriefingPromptBoardSlug = (typeof BRIEFING_PROMPT_BOARD_SLUGS)[number];

const BRIEFING_BOARD_SET = new Set<string>(BRIEFING_PROMPT_BOARD_SLUGS);

/** Extracts `{boardSlug}` from `boardSlug--row-slug` entity ids. */
export function boardSlugFromEntitySlug(entitySlug: string | undefined): string | undefined {
  if (!entitySlug) return undefined;
  const at = entitySlug.indexOf("--");
  if (at <= 0) return undefined;
  return entitySlug.slice(0, at);
}

export function usesBriefingAnalysisPrompt(entitySlug: string | undefined): boolean {
  const boardSlug = boardSlugFromEntitySlug(entitySlug);
  return Boolean(boardSlug && BRIEFING_BOARD_SET.has(boardSlug));
}

export function analysisPromptChannel(entitySlug: string | undefined): PostChannel | undefined {
  const boardSlug = boardSlugFromEntitySlug(entitySlug);
  if (!boardSlug) return undefined;
  return getBoard(boardSlug)?.channel;
}
