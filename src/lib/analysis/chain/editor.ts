import type { ColumnDraft } from "@/lib/analysis/chain/draft";
import type { FactBrief } from "@/lib/analysis/chain/facts";
import { chatJson, editorModel } from "@/lib/analysis/chain/llm";
import { bodyCharCount, sanitizeParagraph, sanitizeParagraphs } from "@/lib/analysis/chain/sanitize";
import type { AnalysisLogger } from "@/lib/analysis/log";
import { numberedHeading } from "@/lib/editorial/copy";
import { BANNED, dropRepeatedSentences } from "@/lib/editorial/rules";
import type { TodayAnalysisSection } from "@/lib/editorial/today-analysis";

/**
 * The audit matches cliché stems (주목받고 있), so a replacement table keyed on
 * finished forms (주목받고 있다) lets conjugations like 주목받고 있는 and
 * 주목받고 있으며 pass the cleaner and then fail the audit. Each rule therefore
 * carries the three endings Korean prose actually uses, and the tail the model
 * wrote decides which replacement fits the sentence's grammatical slot.
 */
interface ConjugatedCliche {
  stem: string;
  terminal: string;
  adnominal: string;
  connective: string;
}

const CONJUGATED: ConjugatedCliche[] = [
  {
    stem: "주목(?:을)?\\s*받고 있",
    terminal: "화제가 됐다",
    adnominal: "화제가 된",
    connective: "화제가 됐고",
  },
  {
    stem: "화제를 모으고 있",
    terminal: "화제가 됐다",
    adnominal: "화제가 된",
    connective: "화제가 됐고",
  },
  {
    stem: "기대를 모으고 있",
    terminal: "기대가 붙었다",
    adnominal: "기대가 붙은",
    connective: "기대가 붙었고",
  },
  {
    stem: "이목이 집중되고 있",
    terminal: "관심이 쏠렸다",
    adnominal: "관심이 쏠린",
    connective: "관심이 쏠렸고",
  },
  {
    stem: "관심이 모아지고 있",
    terminal: "관심이 쏠렸다",
    adnominal: "관심이 쏠린",
    connective: "관심이 쏠렸고",
  },
  {
    stem: "눈길을 끌고 있",
    terminal: "눈길을 끌었다",
    adnominal: "눈길을 끈",
    connective: "눈길을 끌었고",
  },
  {
    stem: "귀추가 주목되",
    terminal: "다음 국면이 남았다",
    adnominal: "다음 국면이 남은",
    connective: "다음 국면이 남았고",
  },
  {
    stem: "다양한 관점이 있",
    terminal: "해석이 갈린다",
    adnominal: "해석이 갈리는",
    connective: "해석이 갈리고",
  },
  {
    stem: "다양한 시각이 존재하",
    terminal: "해석이 갈린다",
    adnominal: "해석이 갈리는",
    connective: "해석이 갈리고",
  },
  {
    stem: "다양한 의견이 나오고 있",
    terminal: "의견이 갈린다",
    adnominal: "의견이 갈리는",
    connective: "의견이 갈리고",
  },
];

const ADNOMINAL = /^(?:는|은|던)$/;
const CONNECTIVE = /^(?:으며|며|고|어|어서|지만|는데|으나|나)$/;

function conjugatedRules(): [RegExp, (match: string, tail: string) => string][] {
  return CONJUGATED.map((rule) => {
    const pattern = new RegExp(`${rule.stem}(습니다|다는|는다|다|은|는|던|으며|며|고|어서|어|지만|는데|으나|나)`, "g");
    const replace = (_match: string, tail: string) => {
      if (ADNOMINAL.test(tail)) return rule.adnominal;
      if (CONNECTIVE.test(tail)) return rule.connective;
      return rule.terminal;
    };
    return [pattern, replace] as [RegExp, (match: string, tail: string) => string];
  });
}

/**
 * Flat phrases with no conjugation to preserve. Deleting outright would leave
 * broken Korean for most of these, so they map to a plain equivalent.
 */
const CLICHE: [RegExp, string][] = [
  [/결론적으로,?\s*/g, ""],
  [/요약하자면,?\s*/g, ""],
  [/종합하면,?\s*/g, ""],
  [/정리하면,?\s*/g, ""],
  [/간단히 정리하면,?\s*/g, ""],
  [/마무리하며,?\s*/g, ""],
  [/한마디로 말해,?\s*/g, ""],
  [/이번 글에서는?,?\s*/g, ""],
  [/이 글에서는,?\s*/g, ""],
  [/이 글은\s*/g, ""],
  [/알아보겠습니다/g, "짚어본다"],
  [/살펴보겠습니다/g, "짚어본다"],
  [/다음과 같습니다/g, "아래와 같다"],
  [/추천합니다/g, "자주 언급된다"],
  [/추천한다/g, "자주 언급된다"],
  [/좋은 선택/g, "현실적인 선택"],
  [/좋은 기회/g, "눈여겨볼 지점"],
  [/향후 전망이 밝다/g, "다음 일정이 남았다"],
  [/앞으로의 행보에 관심이 쏠린다/g, "다음 행보가 남았다"],
  [/긍정적인 반응을 보였다/g, "반응이 갈렸다"],
  [/이 소식에 긍정적인 반응을 보였다/g, "반응이 갈렸다"],
  [/긍정과 부정을 나란히 읽으면,?\s*/g, ""],
  [/대중은\s.{0,24}반응을 보였\S*/g, "반응이 갈렸다"],
  [/생일을 축하하며/g, ""],
  [/뜨거운 관심을 끌었다/g, "검색이 붙었다"],
  [/많은 관심을 받았다/g, "이름이 다시 올랐다"],
];

export function stripCliche(text: string): string {
  let out = text;
  for (const [pattern, replace] of conjugatedRules()) out = out.replace(pattern, replace);
  for (const [pattern, replacement] of CLICHE) out = out.replace(pattern, replacement);
  return out.replace(/\s{2,}/g, " ").replace(/^[,\s]+/, "").trim();
}

function draftBlob(draft: ColumnDraft): string {
  return [
    draft.title,
    draft.excerpt,
    ...draft.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
  ].join(" ");
}

function countCliche(draft: ColumnDraft): number {
  const blob = draftBlob(draft);
  const conjugated = conjugatedRules().reduce(
    (total, [pattern]) => total + (blob.match(pattern)?.length ?? 0),
    0,
  );
  return CLICHE.reduce((total, [pattern]) => total + (blob.match(pattern)?.length ?? 0), conjugated);
}

function applyStrip(draft: ColumnDraft): ColumnDraft {
  const seen = new Set<string>();
  return {
    title: stripCliche(sanitizeParagraph(draft.title)),
    excerpt: stripCliche(sanitizeParagraph(draft.excerpt)),
    sections: draft.sections.map((section) => ({
      ...section,
      heading: stripCliche(section.heading),
      paragraphs: sanitizeParagraphs(section.paragraphs.map(stripCliche))
        .map((paragraph) => dropRepeatedSentences(paragraph, seen))
        .filter(Boolean),
    })),
  };
}

const SYSTEM = [
  "You are a demanding Korean desk editor. You receive a draft column and return the edited version.",
  "Output JSON: { \"title\": string, \"excerpt\": string, \"sections\": [{ \"heading\": string, \"paragraphs\": [string] }] }.",
  "Delete every mechanical stock phrase: 결론적으로, 요약하자면, 종합하면, 주목받고 있다, 이목이 집중되고 있다, 귀추가 주목된다, 다양한 관점이 있다, 화제를 모으고 있다, 기대를 모으고 있다, 긍정적인 반응을 보였다, 생일을 축하하며, 이 소식에 긍정적인 반응, 긍정과 부정을 나란히 읽으면.",
  "If the same fact, quote, or reaction appears twice, keep the first occurrence and rewrite or drop the rest.",
  "Rewrite any sentence that only restates the heading. Every sentence must add information.",
  "Replace vague hedging with the concrete fact it refers to: 작품명, 프로그램명, 행사명, 시점, 인물명.",
  "Split every sentence longer than 40 Korean characters (spaces excluded) into separate sentences.",
  "Never end a sentence on a connective ending such as -으며, -하고, -지만, -때문에. Close it with a finished verb form.",
  "Keep the section count, the paragraph structure and the keyword frequency of the draft.",
  "Keep the total length: the edit must not be shorter than the draft.",
  "Do not introduce facts that are absent from the supplied fact list.",
  "Never mention 시세, 등락, 거래량, 순위, 차트, 가격.",
  "The result must read as a column a human reporter wrote after covering the story.",
].join(" ");

/** Step 3: strip AI tone, enforce concreteness, keep structure intact. */
export async function reviewColumn(input: {
  draft: ColumnDraft;
  brief: FactBrief;
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<ColumnDraft> {
  const { draft, brief, logger } = input;
  const before = countCliche(draft);

  const user = [
    "확인된 팩트(이 범위를 벗어난 사실을 추가하지 마세요):",
    ...brief.facts.map((fact, index) => `${index + 1}. ${fact}`),
    brief.events.length ? `구체 고유명사: ${brief.events.join(", ")}` : "",
    "",
    "검수할 초고:",
    JSON.stringify(
      {
        title: draft.title,
        excerpt: draft.excerpt,
        sections: draft.sections.map((section) => ({
          heading: section.heading.replace(/^[❶❷❸❹❺]\s*/, ""),
          paragraphs: section.paragraphs,
        })),
      },
      null,
      2,
    ),
  ]
    .filter(Boolean)
    .join("\n");

  const result = await chatJson<{ title?: unknown; excerpt?: unknown; sections?: unknown }>({
    system: SYSTEM,
    user,
    temperature: 0.3,
    timeoutMs: input.timeoutMs,
    logger,
    step: "step3-editor",
    model: editorModel(),
  });

  // The editor pass is an improvement, not a gate: on failure we keep the draft
  // and still run the deterministic cliché sweep over it.
  if (!result || !Array.isArray(result.sections)) {
    const swept = applyStrip(draft);
    logger.step("step3-editor", { fallback: "kept draft", clichesStripped: before });
    return swept;
  }

  const sections: TodayAnalysisSection[] = [];
  for (const item of result.sections as { heading?: unknown; paragraphs?: unknown }[]) {
    const paragraphs = Array.isArray(item.paragraphs)
      ? sanitizeParagraphs(
          item.paragraphs
            .filter((row): row is string => typeof row === "string")
            .map((row) => row.replace(/\s+/g, " ").trim()),
        )
      : [];
    const heading =
      typeof item.heading === "string"
        ? item.heading.replace(/^[❶❷❸❹❺\d.\s]+/, "").trim()
        : "";
    if (!heading || !paragraphs.length) continue;
    const index = sections.length;
    sections.push({
      heading: numberedHeading(index, heading),
      headingLevel: index % 2 === 0 ? 2 : 3,
      paragraphs,
    });
  }

  if (sections.length < 3) {
    const swept = applyStrip(draft);
    logger.step("step3-editor", { fallback: "thin edit", sections: sections.length });
    return swept;
  }

  const edited = applyStrip({
    title: typeof result.title === "string" && result.title.trim() ? result.title.trim() : draft.title,
    excerpt:
      typeof result.excerpt === "string" && result.excerpt.trim() ? result.excerpt.trim() : draft.excerpt,
    sections,
  });

  // An editor that trims aggressively can push the body under the length floor,
  // which would hand the article back to the padding reserve.
  const draftChars = bodyCharCount(draft.sections);
  const editedChars = bodyCharCount(edited.sections);
  if (editedChars < draftChars * 0.75) {
    logger.warn("step3-editor", { fallback: "edit cut too much", draftChars, editedChars });
    return applyStrip(draft);
  }

  // Surfacing the exact survivor makes an audit "banned" rejection diagnosable
  // without re-running the chain to reproduce the text.
  const survivor = draftBlob(edited).match(BANNED);
  if (survivor) logger.warn("step3-editor", { bannedSurvivor: survivor[0] });

  logger.step("step3-editor", {
    sections: edited.sections.length,
    chars: editedChars,
    clichesBefore: before,
    clichesAfter: countCliche(edited),
  });
  return edited;
}
