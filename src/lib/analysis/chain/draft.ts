import type { FactBrief } from "@/lib/analysis/chain/facts";
import { chatJson, draftModel } from "@/lib/analysis/chain/llm";
import { bodyCharCount, sanitizeParagraph, sanitizeParagraphs } from "@/lib/analysis/chain/sanitize";
import type { AnalysisLogger } from "@/lib/analysis/log";
import { numberedHeading } from "@/lib/editorial/copy";
import { editorialSystemPrompt } from "@/lib/editorial/rules";
import type { TodayAnalysisSection } from "@/lib/editorial/today-analysis";

export interface ColumnDraft {
  title: string;
  excerpt: string;
  sections: TodayAnalysisSection[];
}

/**
 * Minimum body 자수 the chain must produce to be worth using. Below this the
 * deterministic padding reserve would supply most of the article, mixing a
 * grounded lede with generic filler; a clean template column beats that hybrid.
 */
export const MIN_DRAFT_CHARS = 480;

/**
 * Four sections of six sentences lands the body near 670 characters, which
 * leaves room for the title, table, FAQ and link chrome inside the 800~1,000자
 * budget. The audit wants three to five numbered subheads, so four is in range.
 */
const SECTION_COUNT = 4;
const PARAGRAPHS_PER_SECTION = 2;
const SENTENCES_PER_PARAGRAPH = 3;

interface Outline {
  title: string;
  excerpt: string;
  sections: { heading: string; covers: string }[];
}

function factBlock(brief: FactBrief): string {
  return [
    "확인된 팩트(이 범위를 벗어난 사실을 추가하지 마세요):",
    ...brief.facts.map((fact, index) => `${index + 1}. ${fact}`),
    brief.events.length ? `구체 고유명사·시점: ${brief.events.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** One fact per section so the birthday/reaction line cannot leak into every H2. */
function factBlockForSection(brief: FactBrief, index: number, total: number): string {
  const own = brief.facts[index];
  const leftover = brief.facts.filter((_, i) => i !== index);
  const events =
    index === 0 || index === total - 1 ? brief.events : brief.events.slice(index, index + 1);
  return [
    "이 섹션에서만 쓸 팩트:",
    own ? `· ${own}` : "이 슬롯의 확인된 팩트가 없으니 고유명사만 짧게 쓰세요.",
    events.length ? `이 섹션 고유명사: ${events.join(", ")}` : "",
    leftover.length ? `다른 섹션 전용(절대 쓰지 마세요): ${leftover.join(" / ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** First call: headline plus a plan for what each of the five sections covers. */
async function planOutline(input: {
  keyword: string;
  focus: string;
  supportKw: string;
  label: string;
  brief: FactBrief;
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<Outline | null> {
  const result = await chatJson<{ title?: unknown; excerpt?: unknown; sections?: unknown }>({
    system: [
      "You plan a Korean trend magazine column. You do not write the body yet.",
      'Output JSON: { "title": string, "excerpt": string, "sections": [{ "heading": string, "covers": string }] }.',
      `sections must contain exactly ${SECTION_COUNT} entries.`,
      "heading is a Korean subhead without any number prefix.",
      "covers is one sentence naming what that section will argue. Each section must cover a different fact — do not reuse the same event, quote, or reaction.",
      "Plan a progression: 배경 → 핵심 사건 → 파급과 일정 → 앞으로 볼 지점. Do not plan a 'crowd reaction' section.",
      "Never mention 시세, 등락, 거래량, 순위, 차트, 가격.",
    ].join(" "),
    user: [
      `키워드: ${input.keyword} (분류: ${input.label})`,
      `포커스 키워드: ${input.focus}`,
      `보조 키워드: ${input.supportKw}`,
      "",
      factBlock(input.brief),
      "",
      `제목에는 포커스 키워드 "${input.focus}"가 반드시 그대로 들어가야 합니다.`,
    ].join("\n"),
    temperature: 0.5,
    timeoutMs: input.timeoutMs,
    logger: input.logger,
    step: "step2-outline",
    model: draftModel(),
  });

  if (!result) return null;

  const sections = (Array.isArray(result.sections) ? result.sections : [])
    .flatMap((item) => {
      const row = item as { heading?: unknown; covers?: unknown };
      const heading =
        typeof row.heading === "string" ? row.heading.replace(/^[❶❷❸❹❺\d.\s]+/, "").trim() : "";
      const covers = typeof row.covers === "string" ? row.covers.trim() : "";
      return heading ? [{ heading, covers }] : [];
    })
    .slice(0, SECTION_COUNT);

  const title = typeof result.title === "string" ? sanitizeParagraph(result.title) : "";
  if (!title || sections.length < 3) {
    input.logger.warn("step2-outline", { reason: "incomplete", sections: sections.length });
    return null;
  }

  return {
    title,
    excerpt: typeof result.excerpt === "string" ? sanitizeParagraph(result.excerpt) : "",
    sections,
  };
}

/**
 * Second stage: one call per section. Asking a small model for the whole
 * 60-sentence body in a single response reliably returns ~170 words; scoped to
 * a single section it meets the target, and the calls run concurrently so the
 * split costs latency only in tokens, not wall clock.
 */
async function writeSection(input: {
  index: number;
  outline: Outline;
  focus: string;
  supportKw: string;
  brief: FactBrief;
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<TodayAnalysisSection | null> {
  const plan = input.outline.sections[input.index];
  if (!plan) return null;

  const others = input.outline.sections
    .filter((_, index) => index !== input.index)
    .map((item) => item.heading)
    .join(" / ");

  const result = await chatJson<{ paragraphs?: unknown }>({
    system: editorialSystemPrompt(input.focus, input.supportKw),
    user: [
      `당신은 칼럼의 ${input.index + 1}번째 섹션만 씁니다.`,
      `이 섹션의 소제목: ${plan.heading}`,
      plan.covers ? `이 섹션이 다룰 내용: ${plan.covers}` : "",
      others ? `다른 섹션이 맡은 주제(중복 금지): ${others}` : "",
      "",
      factBlockForSection(input.brief, input.index, input.outline.sections.length),
      "",
      'JSON으로만 출력하세요: { "paragraphs": [string, string] }',
      `문단은 정확히 ${PARAGRAPHS_PER_SECTION}개이고, 각 문단은 ${SENTENCES_PER_PARAGRAPH}문장입니다. 즉 이 섹션은 ${PARAGRAPHS_PER_SECTION * SENTENCES_PER_PARAGRAPH}문장입니다.`,
      "한 문장은 공백 제외 20~40자입니다. 40자를 넘기지 마세요.",
      "문장을 연결어미(-으며, -하고, -지만, -면서)로 끝내지 말고 완결된 서술형으로 닫으세요.",
      `포커스 키워드 "${input.focus}"를 이 섹션에서 1회 이상 쓰세요.`,
      `보조 키워드 "${input.supportKw}"는 이 섹션에서 1회만 쓰세요. 같은 문장을 바꿔 쓰지 마세요.`,
      "위에 적힌 '이 섹션에서만 쓸 팩트' 밖 사건·인용·반응을 쓰지 마세요.",
      "금지 표현: 긍정적인 반응을 보였다, 생일을 축하하며, 이 소식에 긍정적인 반응, 뜨거운 관심을 끌었다, 긍정과 부정을 나란히 읽으면, 대중은 … 반응을 보였다.",
      input.index === 0
        ? `이 섹션의 첫 문장에는 반드시 "${input.focus}"가 들어가야 합니다.`
        : "",
      "본문에 URL이나 마크다운 링크를 넣지 마세요.",
      "소제목은 출력하지 마세요. 문단 배열만 출력합니다.",
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.5,
    timeoutMs: input.timeoutMs,
    logger: input.logger,
    step: `step2-sec${input.index + 1}`,
    model: draftModel(),
  });

  if (!result) return null;

  const paragraphs = sanitizeParagraphs(
    (Array.isArray(result.paragraphs) ? result.paragraphs : [])
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.replace(/\s+/g, " ").trim()),
  );
  if (!paragraphs.length) return null;

  return {
    heading: numberedHeading(input.index, plan.heading),
    headingLevel: input.index % 2 === 0 ? 2 : 3,
    paragraphs,
  };
}

/** Step 2: plan the column, then fill each section in its own call. */
export async function draftColumn(input: {
  keyword: string;
  focus: string;
  supportKw: string;
  label: string;
  brief: FactBrief;
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<ColumnDraft | null> {
  const { logger } = input;

  const outline = await planOutline(input);
  if (!outline) return null;
  logger.step("step2-outline", { sections: outline.sections.length, title: outline.title });

  const written = await Promise.all(
    outline.sections.map((_, index) =>
      writeSection({
        index,
        outline,
        focus: input.focus,
        supportKw: input.supportKw,
        brief: input.brief,
        logger,
        timeoutMs: input.timeoutMs,
      }).catch(() => null),
    ),
  );

  // Renumber after dropping failures so the ❶..❺ sequence stays contiguous.
  const sections = written
    .filter((section): section is TodayAnalysisSection => Boolean(section))
    .map((section, index) => ({
      ...section,
      heading: numberedHeading(index, section.heading.replace(/^[❶❷❸❹❺]\s*/, "")),
      headingLevel: (index % 2 === 0 ? 2 : 3) as 2 | 3,
    }));

  if (sections.length < 3) {
    logger.warn("step2-draft", { reason: "too few sections written", sections: sections.length });
    return null;
  }

  const chars = bodyCharCount(sections);
  logger.step("step2-draft", { sections: sections.length, chars });

  if (chars < MIN_DRAFT_CHARS) {
    logger.warn("step2-draft", { rejected: "body below floor", chars, need: MIN_DRAFT_CHARS });
    return null;
  }

  return { title: outline.title, excerpt: outline.excerpt, sections };
}
