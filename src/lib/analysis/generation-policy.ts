import { analysisPlainText, type TodayAnalysisArticle } from "@/lib/editorial/today-analysis";
import { isPublicEditorialContent, PUBLIC_CONTENT_SINCE_DATE } from "@/lib/content/public-since";
import { isGeminiAnalysis } from "@/lib/analysis/quality";
import type { CachedAnalysis } from "@/lib/analysis/store";

/** Regular refresh cadence for 오늘의 분석 (default 3 days; was 2). */
function envPositiveInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const ANALYSIS_CYCLE_HOURS = envPositiveInt("ANALYSIS_CYCLE_HOURS", 72);
export const ANALYSIS_CYCLE_MS = ANALYSIS_CYCLE_HOURS * 3600_000;

/** Force a full rewrite even when incremental updates keep the column warm. */
export const ANALYSIS_FULL_REWRITE_DAYS = 7;
export const ANALYSIS_FULL_REWRITE_MS = ANALYSIS_FULL_REWRITE_DAYS * 24 * 3600_000;

/** General boards: heatmap ranks 1–N per submenu board (default 5; was 10). */
export const ANALYSIS_RANK_LIMIT_GENERAL = envPositiveInt("ANALYSIS_RANK_LIMIT_GENERAL", 5);
/** Subsidy / grant boards: heatmap ranks 1–N (default 8; was 15). */
export const ANALYSIS_RANK_LIMIT_SUBSIDY = envPositiveInt("ANALYSIS_RANK_LIMIT_SUBSIDY", 8);

/**
 * General columns: fewer than this many valid news/docs → incremental update;
 * otherwise full rewrite (unless forced).
 */
export const ANALYSIS_INCREMENTAL_NEWS_THRESHOLD = 3;

/** Public floor for backfill eligibility (same as reader-facing content). */
export const ANALYSIS_BACKFILL_SINCE_DATE = PUBLIC_CONTENT_SINCE_DATE;

/**
 * 정부 지원금 / grant submenu boards.
 * Keep in sync with `entity-type` grant boards + politics/economy subsidy menus.
 */
export const SUBSIDY_ANALYSIS_BOARD_SLUGS = [
  "government-support-fund",
  "government-subsidy-search",
  "culture-leisure-grant-ranking",
  "travel-government-grant-ranking",
  "entertainment-government-grant-ranking",
] as const;

const SUBSIDY_BOARD_SLUGS = new Set<string>(SUBSIDY_ANALYSIS_BOARD_SLUGS);

export type AnalysisRewriteMode = "full" | "incremental" | "auto";

export type AnalysisRefreshReason =
  | "force"
  | "missing_or_invalid"
  | "reentry"
  | "seven_day_full_rewrite"
  | "cycle_elapsed"
  | "within_cycle";

export interface AnalysisRefreshDecision {
  refresh: boolean;
  /** Hint for the generator; `auto` resolves after RAG (news count / subsidy). */
  mode: AnalysisRewriteMode;
  reason: AnalysisRefreshReason;
}

/** True for 정부 지원금 / grant submenu boards. */
export function isSubsidyAnalysisBoard(boardSlug: string | undefined | null): boolean {
  if (!boardSlug) return false;
  return SUBSIDY_BOARD_SLUGS.has(boardSlug);
}

/** Top-N inventory cap for overnight + on-demand generation scope. */
export function analysisRankLimitForBoard(boardSlug: string | undefined | null): number {
  return isSubsidyAnalysisBoard(boardSlug)
    ? ANALYSIS_RANK_LIMIT_SUBSIDY
    : ANALYSIS_RANK_LIMIT_GENERAL;
}

export function isWithinAnalysisTopN(
  rank: number | undefined | null,
  boardSlug: string | undefined | null,
): boolean {
  const limit = analysisRankLimitForBoard(boardSlug);
  const n = typeof rank === "number" && Number.isFinite(rank) ? rank : 0;
  return n >= 1 && n <= limit;
}

function isImportSource(entry: CachedAnalysis): boolean {
  return Boolean(entry.provenance.model?.startsWith("import:"));
}

/** Timestamp used for the 7-day full-rewrite clock (must not reset on incremental). */
export function lastFullRewriteMs(entry: CachedAnalysis): number {
  const raw = entry.lastFullRewriteAt || entry.generatedAt;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Overnight / cron: decide whether to regenerate and which rewrite mode to hint.
 * Rank-drop columns are simply absent from inventory — never deleted here.
 */
export function shouldRefreshAnalysis(
  existing: CachedAnalysis | null | undefined,
  opts: {
    force?: boolean;
    isReentry?: boolean;
    now?: number;
  } = {},
): AnalysisRefreshDecision {
  const now = opts.now ?? Date.now();

  if (opts.force) {
    return { refresh: true, mode: "full", reason: "force" };
  }

  if (opts.isReentry) {
    return { refresh: true, mode: "full", reason: "reentry" };
  }

  if (
    !existing ||
    !isGeminiAnalysis(existing) ||
    isImportSource(existing) ||
    !isEligibleAnalysisBackfill(existing)
  ) {
    return { refresh: true, mode: "full", reason: "missing_or_invalid" };
  }

  const lastFull = lastFullRewriteMs(existing);
  if (lastFull > 0 && now - lastFull >= ANALYSIS_FULL_REWRITE_MS) {
    return { refresh: true, mode: "full", reason: "seven_day_full_rewrite" };
  }

  const generated = Date.parse(existing.generatedAt);
  if (!Number.isFinite(generated) || now - generated >= ANALYSIS_CYCLE_MS) {
    return { refresh: true, mode: "auto", reason: "cycle_elapsed" };
  }

  return { refresh: false, mode: "incremental", reason: "within_cycle" };
}

/**
 * Resolve `auto` after RAG. Subsidy cycle refreshes prefer incremental;
 * general uses the news-count gate. Missing prior column → always full.
 */
export function resolveRewriteMode(opts: {
  hint: AnalysisRewriteMode;
  isSubsidy: boolean;
  hasPrevious: boolean;
  validNewsCount: number;
}): "full" | "incremental" {
  if (!opts.hasPrevious) return "full";
  if (opts.hint === "full") return "full";
  if (opts.hint === "incremental") return "incremental";
  // auto
  if (opts.isSubsidy) return "incremental";
  return opts.validNewsCount < ANALYSIS_INCREMENTAL_NEWS_THRESHOLD
    ? "incremental"
    : "full";
}

/** Same-slug Gemini column at/after the public floor — never borrow another slug. */
export function isEligibleAnalysisBackfill(
  entry:
    | Pick<CachedAnalysis, "provenance" | "editionDate" | "generatedAt" | "article">
    | null
    | undefined,
): boolean {
  if (!entry || !isGeminiAnalysis(entry)) return false;
  return isPublicEditorialContent({
    editionDate: entry.editionDate || entry.article?.editionDate,
    generatedAt: entry.generatedAt,
  });
}

const SUBSIDY_REQUIRED_PATTERNS: Record<
  "period" | "deadline" | "applyAt" | "prep",
  RegExp
> = {
  // Accept common synonyms the model uses instead of the exact label words.
  period:
    /기간|접수\s*기간|신청\s*기간|모집\s*기간|운영\s*기간|지원\s*기간|시행\s*기간|모집\s*일정|접수\s*일정|신청\s*일정|언제\s*(?:부터|까지)|부터\s*.{0,12}까지/,
  deadline:
    /마감|마감일|신청\s*마감|접수\s*마감|접수\s*일|신청\s*일|마감\s*기한|기한|까지\s*(?:신청|접수|제출)|~\s*\d{1,2}\s*일|당일\s*마감/,
  applyAt:
    /신청처|신청\s*(?:방법|사이트|경로|채널|창구|기관)|접수처|접수\s*(?:방법|사이트|기관)|정부24|복지로|홈페이지|온라인\s*신청|방문\s*신청|포털|누리집|앱(?:에서|으로)?\s*신청|사이트\s*에서\s*신청/,
  prep: /준비물|구비\s*서류|필요\s*서류|제출\s*서류|준비\s*서류|지참\s*서류|첨부\s*서류|서류\s*목록|필요\s*서류|주민등록|신분증|증빙\s*서류|서류\s*제출/,
};

export type SubsidyRequiredField = keyof typeof SUBSIDY_REQUIRED_PATTERNS;

const SUBSIDY_LABEL_FILLERS: Record<SubsidyRequiredField, string> = {
  period: "신청·접수 기간은 소관 기관 공식 공고에서 확인하세요.",
  deadline: "마감 일정(마감일)은 공고 기준을 따르세요.",
  applyAt: "신청처는 정부24·복지로 또는 소관 기관 홈페이지입니다.",
  prep: "준비물·필요 서류는 공고의 구비 서류 목록을 확인하세요.",
};

/**
 * Subsidy columns must mention period, deadline, where to apply, and prep items.
 * Any missing field → generation failure (keep the previous Google/Gemini column).
 */
export function missingSubsidyRequiredFields(
  article: TodayAnalysisArticle | null | undefined,
): SubsidyRequiredField[] {
  const text = analysisPlainText(article);
  if (!text.trim()) {
    return ["period", "deadline", "applyAt", "prep"];
  }
  const missing: SubsidyRequiredField[] = [];
  for (const [key, pattern] of Object.entries(SUBSIDY_REQUIRED_PATTERNS) as [
    SubsidyRequiredField,
    RegExp,
  ][]) {
    pattern.lastIndex = 0;
    if (!pattern.test(text)) missing.push(key);
  }
  return missing;
}

/**
 * Deterministic last-mile patch: if the model omitted a required label word,
 * append honest "check the official notice" sentences that include the labels.
 * Does not invent dates, amounts, or eligibility rules.
 */
export function ensureSubsidyRequiredLabels(
  article: TodayAnalysisArticle,
): TodayAnalysisArticle {
  const missing = missingSubsidyRequiredFields(article);
  if (!missing.length) return article;

  const paragraph = missing.map((key) => SUBSIDY_LABEL_FILLERS[key]).join(" ");
  const sections = [...(article.sections ?? [])];
  if (sections.length) {
    const targetIndex = Math.max(0, sections.length - 2);
    const target = sections[targetIndex]!;
    sections[targetIndex] = {
      ...target,
      paragraphs: [...(target.paragraphs ?? []), paragraph],
    };
    return { ...article, sections };
  }

  const faq = [
    ...(article.faq ?? []),
    {
      question: "신청 전에 무엇을 확인해야 하나요?",
      answer: paragraph,
    },
  ];
  return { ...article, faq };
}

export function assertSubsidyRequiredFields(article: TodayAnalysisArticle): void {
  const missing = missingSubsidyRequiredFields(article);
  if (missing.length) {
    throw new Error(`subsidy-required-missing:${missing.join(",")}`);
  }
}

/** Short prior-column digest for incremental prompts (same slug only). */
export function previousAnalysisDigest(entry: CachedAnalysis | null | undefined): string {
  if (!entry?.article) return "";
  const title = entry.article.title?.trim() || "";
  const excerpt = entry.article.excerpt?.trim() || "";
  const heads = (entry.article.sections ?? [])
    .slice(0, 5)
    .map((section) => section.heading)
    .filter(Boolean);
  const lines = [
    title ? `이전 제목: ${title}` : "",
    excerpt ? `이전 요약: ${excerpt}` : "",
    heads.length ? `이전 소제목: ${heads.join(" / ")}` : "",
    entry.generatedAt ? `이전 생성: ${entry.generatedAt}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}
