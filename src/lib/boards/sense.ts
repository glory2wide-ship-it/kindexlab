import { boardSlugFromEntitySlug } from "@/lib/analysis/briefing-boards";
import { getBoard } from "@/lib/boards/registry";

/**
 * Board-sense disambiguation for ambiguous heatmap keywords.
 *
 * Bare names like "코스모스" retrieve seasonal flower news in autumn even when
 * the row lives on 도서·베스트셀러. Sense metadata biases RAG queries, prompts,
 * and a post-generate quality gate so the column keeps the board's unit meaning.
 */

export interface BoardSense {
  boardSlug: string;
  boardTitle: string;
  shortTitle: string;
  unitLabel: string;
  criteria: string;
  focusKeyword: string;
  /** Human label for prompts, e.g. "도서(책 제목)". */
  senseLabel: string;
  /** Extra search suffixes / phrases (combined with the keyword). */
  searchQualifiers: string[];
  /** Hard rules injected into the user prompt. */
  promptRules: string[];
  /**
   * Off-topic detector: if `wrong` matches the article body and `required`
   * does not, treat as a sense mismatch.
   */
  offSense?: {
    wrong: RegExp;
    required: RegExp;
    label: string;
  };
}

type UnitSensePreset = Pick<BoardSense, "senseLabel" | "searchQualifiers" | "promptRules" | "offSense">;

const UNIT_PRESETS: Record<string, UnitSensePreset> = {
  도서: {
    senseLabel: "도서(책 제목)",
    searchQualifiers: ["책", "도서", "베스트셀러", "서점", "저자", "출판"],
    promptRules: [
      "이 키워드는 도서·베스트셀러 보드의 책 제목입니다.",
      "꽃·식물·야생화·가을 풍경·산책로·개화·백로 등 동음이의어(식물) 해석은 금지합니다.",
      "책·저자·출판·서점·독자·베스트셀러·개정판 맥락으로만 쓰세요.",
    ],
    offSense: {
      // Homonym flower/season copy. Do not use bare "책" as a clear signal —
      // it appears inside words like 산책로.
      wrong:
        /개화|야생화|꽃길|꽃밭|가을\s*꽃|코스모스\s*꽃|백로|산책로|가로수|식물원|단풍놀이|꽃축제|가을\s*정취|전령사/,
      required:
        /칼\s*세이건|세이건|교양서|과학서|베스트셀러|저자|출판사|서점\s*순위|개정판|《[^》]*》/,
      label: "book-vs-flower",
    },
  },
  영화: {
    senseLabel: "영화 작품",
    searchQualifiers: ["영화", "개봉", "박스오피스", "관객"],
    promptRules: [
      "이 키워드는 영화 보드의 작품명입니다. 동명의 책·공연·일반 명사로 바꾸지 마세요.",
    ],
  },
  공연: {
    senseLabel: "공연·작품",
    searchQualifiers: ["공연", "뮤지컬", "연극", "티켓", "예매"],
    promptRules: [
      "이 키워드는 공연 보드의 작품명입니다. 동명의 노래·일반 명사로만 해석하지 마세요.",
    ],
  },
  곡: {
    senseLabel: "음원·곡",
    searchQualifiers: ["노래", "음원", "차트", "앨범"],
    promptRules: ["이 키워드는 음원 보드의 곡명입니다."],
  },
  작품: {
    senseLabel: "콘텐츠 작품",
    searchQualifiers: ["작품", "드라마", "웹툰", "시즌"],
    promptRules: ["이 키워드는 작품명입니다. 동음이의 일반 명사로 바꾸지 마세요."],
  },
  게임: {
    senseLabel: "게임 타이틀",
    searchQualifiers: ["게임", "출시", "업데이트", "플레이"],
    promptRules: ["이 키워드는 게임 타이틀입니다."],
  },
  종목: {
    senseLabel: "주식 종목",
    searchQualifiers: ["주식", "주가", "시총", "증시"],
    promptRules: ["이 키워드는 주식 종목명입니다. 동명의 일반 명사·브랜드 이야기로만 쓰지 마세요."],
  },
};

/** Known ambiguous seeds that need an explicit preferred sense beyond unitLabel. */
const KEYWORD_OVERRIDES: Record<string, Partial<UnitSensePreset>> = {
  코스모스: {
    senseLabel: "도서 《코스모스》(칼 세이건)",
    searchQualifiers: ["책", "칼 세이건", "세이건", "베스트셀러", "과학 교양", "도서"],
    promptRules: [
      "『코스모스』는 칼 세이건의 과학 교양서(도서·베스트셀러)입니다.",
      "가을 꽃·야생화·산책로·개화 등 식물 코스모스 해석은 금지합니다.",
    ],
  },
};

function cleanKeyword(keyword: string): string {
  return keyword.replace(/^\[[^\]]+\]\s*/, "").replace(/\s+/g, " ").trim();
}

export function resolveBoardSense(input: {
  boardSlug?: string | null;
  entitySlug?: string | null;
  keyword?: string | null;
}): BoardSense | null {
  const boardSlug =
    input.boardSlug?.trim() ||
    boardSlugFromEntitySlug(input.entitySlug ?? undefined) ||
    "";
  if (!boardSlug) return null;
  const board = getBoard(boardSlug);
  if (!board) return null;

  const keyword = cleanKeyword(input.keyword ?? "");
  const preset = UNIT_PRESETS[board.unitLabel] ?? {
    senseLabel: `${board.shortTitle}의 ${board.unitLabel}`,
    searchQualifiers: [board.unitLabel, board.focusKeyword].filter(Boolean),
    promptRules: [
      `이 키워드는 "${board.title}" 보드의 ${board.unitLabel} 항목입니다.`,
      `보드 기준: ${board.criteria}`,
      "동음이의어·다른 분야의 일반 명사 해석으로 바꾸지 마세요.",
    ],
  };

  const override = keyword ? KEYWORD_OVERRIDES[keyword] : undefined;
  const merged: UnitSensePreset = {
    senseLabel: override?.senseLabel ?? preset.senseLabel,
    searchQualifiers: [
      ...new Set([...(override?.searchQualifiers ?? []), ...preset.searchQualifiers]),
    ],
    promptRules: [...(override?.promptRules ?? []), ...preset.promptRules],
    offSense: override?.offSense ?? preset.offSense,
  };

  return {
    boardSlug,
    boardTitle: board.title,
    shortTitle: board.shortTitle,
    unitLabel: board.unitLabel,
    criteria: board.criteria,
    focusKeyword: board.focusKeyword,
    ...merged,
  };
}

/** Sense-biased search queries (keyword first, then qualified variants). */
export function boardSenseQueries(keyword: string, sense: BoardSense | null | undefined): string[] {
  const base = cleanKeyword(keyword);
  if (!base) return [];
  if (!sense) return [base];
  const qualified = sense.searchQualifiers
    .map((q) => `${base} ${q}`.trim())
    .filter((q) => q !== base);
  return [...new Set([qualified[0] ?? base, base, ...qualified.slice(1)])];
}

/** Prompt block describing the board sense. */
export function boardSensePromptBlock(sense: BoardSense | null | undefined): string {
  if (!sense) return "";
  return [
    "[보드 의미 · 동음이의어 금지]",
    `- 보드: ${sense.boardTitle} (${sense.boardSlug})`,
    `- 단위: ${sense.unitLabel}`,
    `- 해석: ${sense.senseLabel}`,
    `- 랭킹 기준: ${sense.criteria}`,
    ...sense.promptRules.map((rule) => `- ${rule}`),
  ].join("\n");
}

/** Category hint that includes board title + unit (not just channel type label). */
export function boardSenseCategoryHint(sense: BoardSense | null | undefined, fallback: string): string {
  if (!sense) return fallback;
  return `${sense.shortTitle} · ${sense.unitLabel} · ${sense.senseLabel}`;
}

/**
 * True when generated copy matches the board's forbidden sense and lacks
 * required on-sense markers (e.g. flower cosmos on a book board).
 *
 * Uses hit counts so a single throwaway "도서" mention cannot launder a
 * flower-dominated column.
 */
export function detectBoardSenseMismatch(input: {
  plainText: string;
  boardSlug?: string | null;
  entitySlug?: string | null;
  keyword?: string | null;
}): string | null {
  const sense = resolveBoardSense(input);
  if (!sense?.offSense) return null;
  const text = input.plainText.replace(/\s+/g, " ");
  const wrongHits = text.match(new RegExp(sense.offSense.wrong.source, "g"))?.length ?? 0;
  const requiredHits =
    text.match(new RegExp(sense.offSense.required.source, "g"))?.length ?? 0;
  if (wrongHits === 0) return null;
  if (requiredHits >= 2) return null;
  if (wrongHits >= 2 && requiredHits === 0) return sense.offSense.label;
  if (wrongHits >= 3 && requiredHits < 2) return sense.offSense.label;
  return null;
}

/** Prefer RAG rows that look on-sense; keep others as fallback. */
export function rankSourcesByBoardSense<T extends { title: string; snippet?: string }>(
  sources: T[],
  sense: BoardSense | null | undefined,
): T[] {
  if (!sense || sources.length < 2) return sources;
  const quals = sense.searchQualifiers.map((q) => q.toLowerCase());
  const wrong = sense.offSense?.wrong;
  const score = (row: T) => {
    const blob = `${row.title} ${row.snippet ?? ""}`.toLowerCase();
    let s = 0;
    for (const q of quals) {
      if (blob.includes(q.toLowerCase())) s += 2;
    }
    if (wrong?.test(blob) && !sense.offSense?.required.test(blob)) s -= 4;
    return s;
  };
  return [...sources].sort((a, b) => score(b) - score(a));
}
