import { analysisLogger } from "@/lib/analysis/log";
import { BRIEFING_LLM, chatJson, briefingLlmConfigured } from "@/lib/analysis/chain/llm";
import { countWords } from "@/lib/briefing/compose";
import { editorialSystemPrompt, hasBannedCopy, MIN_WORDS } from "@/lib/editorial/rules";
import type { BriefingArticle, BriefingKind, BriefingSection, CategoryId } from "@/lib/types";

interface AiDraft {
  title: string;
  excerpt: string;
  sections: BriefingSection[];
}

/** Legacy helper — routes through Gemini (BRIEFING_LLM), not OpenAI. */
export async function generateWithAi(input: {
  editionDate: string;
  kind: BriefingKind;
  category: CategoryId;
  focus: string;
  supportKw: string;
}): Promise<AiDraft | null> {
  if (!briefingLlmConfigured()) return null;

  const draft = await chatJson<AiDraft>({
    system: editorialSystemPrompt(input.focus, input.supportKw),
    user: `키워드만 제공됩니다: ${input.focus}. 보조 주제: ${input.supportKw}. 날짜 ${input.editionDate}. 수치 데이터는 일절 제공되지 않습니다. 이 키워드의 산업적·사회적 배경, 화제가 된 이유, 파급력, 초보자 가이드, 향후 전망만 쓰세요. 쇼핑몰·쿠팡·토스쇼핑 문장은 넣지 마세요.`,
    temperature: 0.5,
    timeoutMs: 45_000,
    provider: BRIEFING_LLM.provider,
    model: BRIEFING_LLM.draftModel(),
    logger: analysisLogger("briefing:legacy-ai"),
    step: "legacy-draft",
  });
  if (!draft?.title || !Array.isArray(draft.sections) || !draft.sections.length) return null;
  if (hasBannedCopy(`${draft.title}${draft.excerpt}`)) return null;
  const words = countWords(draft);
  if (words < MIN_WORDS) return null;
  return draft;
}
