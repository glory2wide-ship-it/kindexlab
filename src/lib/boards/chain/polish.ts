import { chatJson, editorModel } from "@/lib/analysis/chain/llm";
import { stripCliche } from "@/lib/analysis/chain/editor";
import type { AnalysisLogger } from "@/lib/analysis/log";
import type { TodayAnalysisSection } from "@/lib/editorial/today-analysis";
import type { BoardReport } from "@/lib/boards/types";

interface RawPolish {
  sections?: { heading?: unknown; paragraphs?: unknown }[];
  target_analysis?: { heading?: unknown; paragraphs?: unknown };
}

const SYSTEM = [
  "당신은 매거진 데스크의 교열 에디터다.",
  "문장의 사실관계와 수치는 그대로 두고 어투만 다듬는다.",
  "기계적 상투어를 삭제하고 사람이 직접 취재해 쓴 문장으로 바꾼다.",
  "금지어: 결론적으로, 요약하자면, 주목받고 있다, 귀추가 주목된다, 다양한 관점이 있다, 중요한 역할을 한다.",
  "문단 수와 순서를 바꾸지 않는다. 각 문단의 길이도 비슷하게 유지한다.",
  "반드시 지정된 JSON 스키마만 반환한다.",
].join(" ");

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function mergeSection(
  original: TodayAnalysisSection,
  raw: { heading?: unknown; paragraphs?: unknown } | undefined,
): TodayAnalysisSection {
  const paragraphs = Array.isArray(raw?.paragraphs)
    ? raw.paragraphs.map((item) => stripCliche(cleanText(item))).filter((item) => item.length >= 20)
    : [];
  // An edit that drops content is worse than no edit, so keep the original
  // whenever the pass returns fewer paragraphs than it was given.
  if (paragraphs.length < original.paragraphs.length) return original;
  const heading = stripCliche(cleanText(raw?.heading));
  return {
    heading: heading || original.heading,
    headingLevel: original.headingLevel,
    paragraphs: paragraphs.slice(0, original.paragraphs.length),
  };
}

/**
 * Step 3 — the anti-AI tone pass on the stronger model. Never fails the build:
 * a rejected or timed-out edit returns the input report unchanged.
 */
export async function polishBoardReport(input: {
  report: BoardReport;
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<BoardReport> {
  const { report, logger } = input;

  const payload = {
    sections: report.sections.map((section) => ({
      heading: section.heading,
      paragraphs: section.paragraphs,
    })),
    target_analysis: {
      heading: report.targetAnalysis.heading,
      paragraphs: report.targetAnalysis.paragraphs,
    },
  };

  const parsed = await chatJson<RawPolish>({
    system: SYSTEM,
    user: `아래 리포트의 어투를 교정해 같은 구조의 JSON으로 반환하라.\n\n${JSON.stringify(payload, null, 2)}`,
    temperature: 0.3,
    timeoutMs: input.timeoutMs ?? 45_000,
    logger,
    step: "board:polish",
    model: editorModel(),
  });

  if (!parsed) return report;

  const sections = report.sections.map((section, index) =>
    mergeSection(section, parsed.sections?.[index]),
  );
  const targetAnalysis = mergeSection(report.targetAnalysis, parsed.target_analysis);

  return { ...report, sections, targetAnalysis };
}
