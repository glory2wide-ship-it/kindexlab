import { countWords } from "@/lib/briefing/compose";
import { editorialSystemPrompt, hasBannedCopy, MIN_WORDS } from "@/lib/editorial/rules";
import type { BriefingArticle, BriefingKind, BriefingSection, CategoryId } from "@/lib/types";

interface AiDraft {
  title: string;
  excerpt: string;
  sections: BriefingSection[];
}

export async function generateWithAi(input: {
  editionDate: string;
  kind: BriefingKind;
  category: CategoryId;
  focus: string;
  supportKw: string;
}): Promise<AiDraft | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: editorialSystemPrompt(input.focus, input.supportKw),
          },
          {
            role: "user",
            content: `키워드만 제공됩니다: ${input.focus}. 보조 주제: ${input.supportKw}. 날짜 ${input.editionDate}. 수치 데이터는 일절 제공되지 않습니다. 이 키워드의 산업적·사회적 배경, 화제가 된 이유, 파급력, 초보자 가이드, 향후 전망만 쓰세요. 쇼핑몰·쿠팡·토스쇼핑 문장은 넣지 마세요.`,
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) return null;
    const draft = JSON.parse(raw) as AiDraft;
    if (!draft.title || !draft.excerpt || !Array.isArray(draft.sections) || draft.sections.length < 4) {
      return null;
    }
    if (hasBannedCopy(`${draft.title}${draft.excerpt}${draft.sections.map((row) => row.paragraphs.join(" ")).join(" ")}`)) {
      return null;
    }
    const words = countWords({
      title: draft.title,
      excerpt: draft.excerpt,
      sections: draft.sections,
    });
    if (words < MIN_WORDS - 200) return null;
    draft.sections = draft.sections.map((section, index) => ({
      ...section,
      kind: index === 0 ? "tape" : "briefing",
      headingLevel:
        section.headingLevel === 3 || section.headingLevel === 2
          ? section.headingLevel
          : index === 0 || index % 3 === 0
            ? 2
            : 3,
    }));
    return draft;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function applyAiDraft(
  base: BriefingArticle,
  draft: AiDraft,
): BriefingArticle {
  const next = {
    ...base,
    title: draft.title.includes(base.focusKeyword ?? "") ? draft.title : base.title,
    excerpt: draft.excerpt || base.excerpt,
    sections: draft.sections.length
      ? [
          { ...draft.sections[0], kind: "tape" as const },
          ...draft.sections.slice(1).map((section) => ({ ...section, kind: "briefing" as const })),
        ]
      : base.sections,
  };
  const wordCount = countWords(next);
  return {
    ...next,
    wordCount,
    readingMinutes: Math.max(8, Math.round(wordCount / 180)),
  };
}
