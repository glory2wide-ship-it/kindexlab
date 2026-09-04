import { chatJson, draftModel } from "@/lib/analysis/chain/llm";
import { stripCliche } from "@/lib/analysis/chain/editor";
import type { AnalysisLogger } from "@/lib/analysis/log";
import { tableMarkdown } from "@/lib/editorial/rules";
import type { TodayAnalysisSection } from "@/lib/editorial/today-analysis";
import type { PostFaq, PostTable } from "@/lib/posts/types";
import type { BoardDefinition, BoardRankEntry, BoardReport, DemographicRanking } from "@/lib/boards/types";
import { AGE_LABEL, GENDER_LABEL } from "@/lib/boards/demographics";

const MIN_CHARS = 1_000;
const NUMBERING = ["❶", "❷", "❸", "❹", "❺"];

interface RawSection {
  heading?: unknown;
  paragraphs?: unknown;
}

interface RawReport {
  title?: unknown;
  excerpt?: unknown;
  sections?: unknown;
  target_analysis?: RawSection;
  faq?: unknown;
}

const SYSTEM = [
  "당신은 데이터 저널리즘 매거진의 랭킹 리포트 담당 기자다.",
  "제공된 순위표를 근거로 '왜 이 항목이 1위인가'를 분석하는 리포트를 쓴다.",
  "문장은 20~45자로 짧게 끊고, 한 문단은 3~4문장이다.",
  "모든 문장 끝에는 마침표(.)를 온전하게 찍는다. 종결 부호 누락·문장 급절단을 하지 않는다.",
  "'결론적으로', '주목받고 있다', '귀추가 주목된다', '다양한 관점이 있다', '요약하자면', '긍정적인 반응을 보였다', '생일을 축하하며', '긍정과 부정을 나란히 읽으면' 같은 기계적 상투어를 절대 쓰지 않는다.",
  "같은 사실이나 반응을 문단마다 반복하지 않는다. 각 문장은 새로운 근거를 보탠다.",
  "FAQ 답변은 순위표의 항목명과 지수를 인용한다. 감정 평가나 상투적 감탄문은 쓰지 않는다.",
  "순위와 지수 수치를 본문에 직접 인용해 근거로 삼는다.",
  "광고 문구나 상품 추천 문장은 쓰지 않는다.",
  "반드시 지정된 JSON 스키마만 반환한다.",
].join(" ");

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanParagraphs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => stripCliche(cleanText(item)))
    .filter((item) => item.length >= 20)
    .slice(0, 4);
}

function toSections(value: unknown): TodayAnalysisSection[] {
  if (!Array.isArray(value)) return [];
  const out: TodayAnalysisSection[] = [];
  for (const raw of value as RawSection[]) {
    const heading = stripCliche(cleanText(raw?.heading));
    const paragraphs = cleanParagraphs(raw?.paragraphs);
    if (!heading || !paragraphs.length) continue;
    out.push({
      heading: `${NUMBERING[out.length] ?? ""} ${heading}`.trim(),
      headingLevel: 2,
      paragraphs,
    });
    if (out.length >= 4) break;
  }
  return out;
}

function toFaq(value: unknown): PostFaq[] {
  if (!Array.isArray(value)) return [];
  const out: PostFaq[] = [];
  for (const raw of value as { question?: unknown; answer?: unknown }[]) {
    const question = cleanText(raw?.question);
    const answer = stripCliche(cleanText(raw?.answer));
    if (!question || answer.length < 20) continue;
    out.push({ question, answer });
    if (out.length >= 3) break;
  }
  return out;
}

function rankingTable(board: BoardDefinition, ranking: BoardRankEntry[]): PostTable {
  const table: PostTable = {
    caption: `${board.title} 상위 5위 (100점 척도)`,
    headers: ["순위", board.unitLabel, "지수", "등락", "근거"],
    rows: ranking.slice(0, 5).map((row) => [
      `${row.rank}위`,
      row.name,
      row.score.toFixed(2),
      `${row.changeRate > 0 ? "+" : ""}${row.changeRate.toFixed(2)}%`,
      row.note,
    ]),
  };
  return { ...table, markdown: tableMarkdown(table) };
}

function demographicDigest(demographics: DemographicRanking): string {
  const gender = (Object.keys(GENDER_LABEL) as (keyof typeof GENDER_LABEL)[])
    .map((key) => `${GENDER_LABEL[key]} 1위 ${demographics.gender[key]?.[0]?.name ?? "-"}`)
    .join(", ");
  const age = (Object.keys(AGE_LABEL) as (keyof typeof AGE_LABEL)[])
    .map((key) => `${AGE_LABEL[key]} 1위 ${demographics.age[key]?.[0]?.name ?? "-"}`)
    .join(", ");
  return `${gender} / ${age}`;
}

export function buildTemplateBoardReport(
  board: BoardDefinition,
  ranking: BoardRankEntry[],
  demographics: DemographicRanking,
): BoardReport {
  return padToMinimum(fallbackReport(board, ranking, demographics), board, ranking, demographics);
}

/** Ranking shells only — no editorial prose until Gemini writes the board report. */
export function emptyBoardReport(board: BoardDefinition): BoardReport {
  return {
    title: board.title,
    excerpt: "",
    sections: [],
    table: { caption: "", headers: [], rows: [] },
    faq: [],
    targetAnalysis: { heading: "", headingLevel: 2, paragraphs: [] },
    characterCount: 0,
    readingMinutes: 0,
  };
}

function fallbackReport(
  board: BoardDefinition,
  ranking: BoardRankEntry[],
  demographics: DemographicRanking,
): BoardReport {
  const lead = ranking[0];
  const second = ranking[1];
  const table = rankingTable(board, ranking);

  const sections: TodayAnalysisSection[] = [
    {
      heading: `❶ ${board.title} 1위는 ${lead?.name ?? "상위 항목"}`,
      headingLevel: 2,
      paragraphs: [
        `${board.title} 집계에서 ${lead?.name ?? "1위 항목"}이 ${lead?.score.toFixed(2) ?? "-"}점으로 선두에 섰다. 산출 기준은 ${board.criteria}다. ${lead?.note ?? ""}`,
        `2위 ${second?.name ?? "-"}와의 격차는 ${(((lead?.score ?? 0) - (second?.score ?? 0)) || 0).toFixed(2)}점이다. 상위권은 언급량이 특정 시점에 몰리는 구조를 공유한다.`,
      ],
    },
    {
      heading: `❷ 상위권을 가른 신호`,
      headingLevel: 2,
      paragraphs: [
        `${board.focusKeyword} 지표는 검색 관심도와 보도량이 동시에 올라갈 때 급등한다. 한쪽만 오르면 순위는 유지되되 지수는 정체한다.`,
        `${board.supportKeyword} 관점에서 보면 하위권과의 차이는 지속성이다. 단발성 이슈는 다음 집계에서 빠르게 내려앉는다.`,
      ],
    },
  ];

  const targetAnalysis: TodayAnalysisSection = {
    heading: "❸ 세대별·성별 분석 리포트",
    headingLevel: 2,
    paragraphs: [
      `성별로 보면 남성 1위는 ${demographics.gender.male?.[0]?.name ?? "-"}, 여성 1위는 ${demographics.gender.female?.[0]?.name ?? "-"}다. 같은 보드에서도 상위 항목이 갈린다.`,
      `연령대별로는 20대가 ${demographics.age["20s"]?.[0]?.name ?? "-"}, 50대가 ${demographics.age["50s"]?.[0]?.name ?? "-"}를 앞세웠다. 세대별 소비 경로가 다르기 때문이다.`,
      `${board.focusKeyword}에서 세대 차이는 정보를 접하는 채널에서 나온다. 젊은 층은 숏폼, 상위 연령대는 포털과 방송을 경유한다.`,
    ],
  };

  const faq: PostFaq[] = [
    {
      question: `${board.title}는 어떻게 산출하나요?`,
      answer: `${board.criteria}를 종합해 100점 척도로 환산합니다. 수치는 편집 기준에 따른 추정 지수입니다.`,
    },
    {
      question: "성별·연령별 순위는 어디서 나온 값인가요?",
      answer:
        "검색 트렌드의 인구통계 특성을 반영해 세그먼트별로 재배열한 추정치입니다. 실측 설문 결과가 아닙니다.",
    },
    {
      question: "순위는 얼마나 자주 갱신되나요?",
      answer: "집계는 편성 주기에 맞춰 하루 단위로 갱신되며, 캐시가 만료되면 새 보도를 반영해 다시 산출합니다.",
    },
  ];

  return finalize({ title: `${board.title} TOP 10`, excerpt: `${board.criteria} 기준으로 본 ${board.title} 상위 10위와 세대별 차이.`, sections, targetAnalysis, table, faq });
}

function countChars(report: Omit<BoardReport, "characterCount" | "readingMinutes">): number {
  const body = [
    report.excerpt,
    ...report.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    report.targetAnalysis.heading,
    ...report.targetAnalysis.paragraphs,
    ...report.faq.flatMap((item) => [item.question, item.answer]),
  ].join("");
  return body.replace(/\s+/g, "").length;
}

function finalize(report: Omit<BoardReport, "characterCount" | "readingMinutes">): BoardReport {
  const characterCount = countChars(report);
  return {
    ...report,
    characterCount,
    readingMinutes: Math.max(1, Math.round(characterCount / 500)),
  };
}

/**
 * Step 2 — the SEO body. Writes a data-analysis report explaining the top of the
 * board, and always carries the mandated demographic breakdown section. Falls
 * back to a deterministic report so a board never renders empty.
 */
export async function writeBoardReport(input: {
  board: BoardDefinition;
  ranking: BoardRankEntry[];
  demographics: DemographicRanking;
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<{ report: BoardReport; fromLlm: boolean }> {
  const { board, ranking, demographics, logger } = input;
  const table = rankingTable(board, ranking);

  const rankLines = ranking
    .slice(0, 10)
    .map((row) => `${row.rank}위 ${row.name} (${row.score.toFixed(2)}점, ${row.changeRate.toFixed(2)}%) - ${row.note}`)
    .join("\n");

  const user = [
    `보드: ${board.title}`,
    `산출 기준: ${board.criteria}`,
    `포커스 키워드: ${board.focusKeyword} / 보조 키워드: ${board.supportKeyword}`,
    "",
    `전체 순위:\n${rankLines}`,
    "",
    `세그먼트 1위 요약: ${demographicDigest(demographics)}`,
    "",
    "아래 JSON으로 반환하라.",
    "{",
    '  "title": "H1 제목(포커스 키워드 포함, 30자 내외)",',
    '  "excerpt": "요약 2문장",',
    '  "sections": [ { "heading": "H2 소제목", "paragraphs": ["문단", "문단", "문단"] } × 3 ],',
    '  "target_analysis": { "heading": "세대별·성별 분석 리포트", "paragraphs": ["문단", "문단", "문단"] },',
    '  "faq": [ { "question": "질문", "answer": "답변" } × 3 ]',
    "}",
    "",
    `sections에는 1위 항목이 왜 1위인지, 상위권과 하위권을 가른 요인, ${board.supportKeyword}의 향후 관전 포인트를 각각 담아라.`,
    "target_analysis에는 '왜 특정 세대가 이 항목에 반응하는가'를 심리와 소비 경로 중심으로 날카롭게 분석하라. 성별 차이와 연령 차이를 각각 최소 한 문단씩 다뤄라.",
    "경제·모빌리티 보드라면 40대 남성이 수입차 감가상각과 에어서스펜션 유지비에 집착하는 이유를 구체적으로 써라.",
    `각 문단은 3~4문장(120자 이상)으로 쓰고, 전체 본문은 공백 제외 ${MIN_CHARS}자 이상이어야 한다.`,
    "분량이 모자라면 순위표의 4~10위 항목을 근거로 문단을 더 채워라.",
  ].join("\n");

  const parsed = await chatJson<RawReport>({
    system: SYSTEM,
    user,
    temperature: 0.55,
    timeoutMs: input.timeoutMs ?? 60_000,
    logger,
    step: "board:report",
    model: draftModel(),
  });

  const sections = toSections(parsed?.sections);
  const targetHeading = stripCliche(cleanText(parsed?.target_analysis?.heading)) || "세대별·성별 분석 리포트";
  const targetParagraphs = cleanParagraphs(parsed?.target_analysis?.paragraphs);
  const faq = toFaq(parsed?.faq);
  const title = stripCliche(cleanText(parsed?.title));
  const excerpt = stripCliche(cleanText(parsed?.excerpt));

  if (sections.length < 2 || targetParagraphs.length < 2 || faq.length < 3 || !title) {
    logger.warn("board:report", {
      rejected: "incomplete",
      sections: sections.length,
      target: targetParagraphs.length,
      faq: faq.length,
    });
    return { report: fallbackReport(board, ranking, demographics), fromLlm: false };
  }

  const targetAnalysis: TodayAnalysisSection = {
    heading: `${NUMBERING[sections.length] ?? "❹"} ${targetHeading}`,
    headingLevel: 2,
    paragraphs: targetParagraphs,
  };

  const report = finalize({
    title,
    excerpt: excerpt || `${board.criteria} 기준 ${board.title} 상위 10위.`,
    sections,
    targetAnalysis,
    table,
    faq,
  });

  if (report.characterCount < MIN_CHARS) {
    logger.warn("board:report", { short: report.characterCount, need: MIN_CHARS });
    return { report: padToMinimum(report, board, ranking, demographics), fromLlm: true };
  }

  return { report, fromLlm: true };
}

/**
 * Tops a short model draft up to the mandated length. Appends deterministic
 * paragraphs one at a time and re-counts after each, so the result clears the
 * floor instead of stopping at an arbitrary section cap.
 */
function padToMinimum(
  report: BoardReport,
  board: BoardDefinition,
  ranking: BoardRankEntry[],
  demographics: DemographicRanking,
): BoardReport {
  const filler = fallbackReport(board, ranking, demographics);
  const pool = [
    ...filler.sections.flatMap((section) => section.paragraphs),
    ...filler.targetAnalysis.paragraphs,
  ];

  const sections = report.sections.map((section) => ({ ...section, paragraphs: [...section.paragraphs] }));
  const targetAnalysis = { ...report.targetAnalysis, paragraphs: [...report.targetAnalysis.paragraphs] };
  const used = new Set(
    [...sections.flatMap((section) => section.paragraphs), ...targetAnalysis.paragraphs],
  );

  let current = finalize({ ...report, sections, targetAnalysis });
  let cursor = 0;
  let target = 0;

  while (current.characterCount < MIN_CHARS && cursor < pool.length) {
    const paragraph = pool[cursor];
    cursor += 1;
    if (!paragraph || used.has(paragraph)) continue;
    used.add(paragraph);
    // Spread the additions across sections rather than bloating the first one.
    const bucket = sections[target % sections.length];
    bucket.paragraphs.push(paragraph);
    target += 1;
    current = finalize({ ...report, sections, targetAnalysis });
  }

  return current;
}
