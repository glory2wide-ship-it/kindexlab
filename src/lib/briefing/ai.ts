import { countWords } from "@/lib/briefing/compose";
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
  facts: string;
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
            content:
              "You are EnterBuzz, a Korean K-culture market desk. Write analytical Korean journalism, not hype. Return JSON {title, excerpt, sections:[{heading, paragraphs: string[]}]} with at least 7 sections and 1000+ Korean space-separated words. Do not mention advertising revenue models.",
          },
          {
            role: "user",
            content: `날짜 ${input.editionDate}, 유형 ${input.kind}, 카테고리 ${input.category}. 팩트:\n${input.facts}\n시세판 링크와 카테고리 히트맵을 본문에 자연스럽게 언급하세요.`,
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
    const words = countWords({
      title: draft.title,
      excerpt: draft.excerpt,
      sections: draft.sections,
    });
    if (words < 1000) return null;
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
    title: draft.title,
    excerpt: draft.excerpt,
    sections: draft.sections,
  };
  const wordCount = countWords(next);
  return {
    ...next,
    wordCount,
    readingMinutes: Math.max(8, Math.round(wordCount / 120)),
  };
}
