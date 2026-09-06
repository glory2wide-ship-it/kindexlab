import { chatJson, draftModel } from "@/lib/analysis/chain/llm";
import { stripCliche } from "@/lib/analysis/chain/editor";
import type { AnalysisLogger } from "@/lib/analysis/log";
import { AGE_LABEL, GENDER_LABEL } from "@/lib/boards/demographics";
import type { BoardDefinition, BoardPump, BoardRankEntry, DemographicRanking } from "@/lib/boards/types";

interface RawPump {
  shorts_title?: unknown;
  shorts_script?: unknown;
  pinned_comment?: unknown;
}

const PINNED_FALLBACK = "내 연령대 순위와 최저가 정보는 고정댓글 링크에서 바로 확인하세요.";

const SYSTEM = [
  "당신은 15초 세로형 숏폼 대본을 쓰는 작가다.",
  "대본은 반드시 랭킹 포맷이다. 첫 문장은 특정 성별·연령대를 직접 호명하는 훅으로 시작한다.",
  "문장은 짧게 끊고, 4~6줄로 구성한다. 전체가 15초 안에 읽혀야 한다.",
  "과장된 단정이나 허위 사실을 넣지 않는다. 제공된 순위와 수치만 쓴다.",
  "반드시 지정된 JSON 스키마만 반환한다.",
].join(" ");

function cleanText(value: unknown): string {
  return typeof value === "string" ? stripCliche(value.replace(/\s+/g, " ").trim()) : "";
}

function pickHook(demographics: DemographicRanking): { label: string; leader: string } | null {
  // Combined age+gender labels convert better ("지금 50대 남성들이…") than a lone axis.
  const pairs: { label: string; rows?: BoardRankEntry[] }[] = [
    { label: "50대 남성들", rows: demographics.age["50s"] },
    { label: "40대 남성들", rows: demographics.age["40s"] },
    { label: "20대 여성들", rows: demographics.age["20s"] },
    { label: "30대 여성들", rows: demographics.age["30s"] },
    { label: `${AGE_LABEL["20s"]}들`, rows: demographics.age["20s"] },
    { label: `${AGE_LABEL["30s"]}들`, rows: demographics.age["30s"] },
    { label: `${AGE_LABEL["40s"]}들`, rows: demographics.age["40s"] },
    { label: `${AGE_LABEL["50s"]}들`, rows: demographics.age["50s"] },
    { label: `${GENDER_LABEL.female}들`, rows: demographics.gender.female },
    { label: `${GENDER_LABEL.male}들`, rows: demographics.gender.male },
  ];
  for (const item of pairs) {
    const leader = item.rows?.[0]?.name;
    if (leader) return { label: item.label, leader };
  }
  return null;
}

export function buildTemplatePump(
  board: BoardDefinition,
  ranking: BoardRankEntry[],
  demographics: DemographicRanking,
): BoardPump {
  return fallbackPump(board, ranking, demographics);
}

function fallbackPump(
  board: BoardDefinition,
  ranking: BoardRankEntry[],
  demographics: DemographicRanking,
): BoardPump {
  const hook = pickHook(demographics);
  const top3 = ranking.slice(0, 3);
  const lines = [
    hook
      ? `지금 ${hook.label}이 폭풍 검색 중인 ${board.shortTitle} Top 3`
      : `이번 주 ${board.shortTitle} Top 3 공개합니다.`,
    ...top3.map((row) => `${row.rank}위 ${row.name}, ${row.score.toFixed(0)}점.`),
    "전체 순위는 아래 링크에서 확인하세요.",
  ];

  return {
    shortsTitle: `${board.shortTitle} TOP 3`,
    shortsScript: lines,
    pinnedComment: PINNED_FALLBACK,
  };
}

/**
 * Step 4 — distribution assets. Produces a ranking-format short and the pinned
 * comment that routes viewers to the full board.
 */
export async function buildBoardPump(input: {
  board: BoardDefinition;
  ranking: BoardRankEntry[];
  demographics: DemographicRanking;
  articleUrl: string;
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<BoardPump> {
  const { board, ranking, demographics, logger } = input;
  const hook = pickHook(demographics);

  const user = [
    `보드: ${board.title}`,
    `전체 1~3위: ${ranking.slice(0, 3).map((row) => `${row.rank}위 ${row.name}(${row.score.toFixed(0)}점)`).join(", ")}`,
    hook ? `타겟 훅 소재: ${hook.label}에서 1위는 ${hook.leader}` : "",
    `링크: ${input.articleUrl}`,
    "",
    "아래 JSON으로 반환하라.",
    "{",
    `  "shorts_title": "랭킹형 제목 (예: 이번 주 떡상한 ${board.shortTitle} 순위)",`,
    '  "shorts_script": ["훅 문장", "3위", "2위", "1위", "마무리 유도 문장"],',
    `  "pinned_comment": "${PINNED_FALLBACK}"`,
    "}",
    "",
    "shorts_script의 첫 문장은 반드시 특정 성별 또는 연령대를 호명하는 훅이어야 한다.",
    `예: 지금 50대 남성들이 폭풍 검색 중인 ${board.shortTitle} Top 3`,
  ]
    .filter(Boolean)
    .join("\n");

  const parsed = await chatJson<RawPump>({
    system: SYSTEM,
    user,
    temperature: 0.7,
    timeoutMs: input.timeoutMs ?? 30_000,
    logger,
    step: "board:pump",
    model: draftModel(),
  });

  const script = Array.isArray(parsed?.shorts_script)
    ? parsed.shorts_script.map((item) => cleanText(item)).filter((item) => item.length >= 4).slice(0, 6)
    : [];
  const title = cleanText(parsed?.shorts_title);

  if (script.length < 3 || !title) {
    logger.warn("board:pump", { rejected: "thin", lines: script.length });
    return fallbackPump(board, ranking, demographics);
  }

  return {
    shortsTitle: title,
    shortsScript: script,
    pinnedComment: cleanText(parsed?.pinned_comment) || PINNED_FALLBACK,
  };
}
