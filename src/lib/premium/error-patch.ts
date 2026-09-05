/**
 * Cheap error-patch pass: feed only the violation notes + current draft to
 * gpt-4o-mini instead of regenerating the whole article.
 */

import { BRIEFING_LLM, chatJson, type ChatOptions } from "@/lib/analysis/chain/llm";
import type { AnalysisLogger } from "@/lib/analysis/log";
import { ERROR_PATCH_JSON_SCHEMA } from "@/lib/premium/schemas";
import { autoCorrectArticleFields } from "@/lib/premium/postprocess";
import { buildCacheableSystemPrompt, premiumPromptCacheKey } from "@/lib/premium/prompt";
import type { PostChannel, PostFaq } from "@/lib/posts/types";

export type PatchSection = {
  heading: string;
  headingLevel: 2 | 3;
  paragraphs: string[];
};

export type PatchableDraft = {
  title: string;
  excerpt: string;
  sections: PatchSection[];
  faq: PostFaq[];
};

export type QualityViolation = {
  code: string;
  detail: string;
};

function draftPlain(draft: PatchableDraft): string {
  return [
    draft.title,
    draft.excerpt,
    ...draft.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    ...draft.faq.flatMap((item) => [item.question, item.answer]),
  ].join("\n");
}

/**
 * Asks the economy model to rewrite only the broken parts of an otherwise
 * usable draft. Returns null if the patch call fails.
 */
export async function patchDraftViolations(input: {
  draft: PatchableDraft;
  violations: QualityViolation[];
  keyword: string;
  channel?: PostChannel;
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<PatchableDraft | null> {
  if (!input.violations.length) return input.draft;

  const system = buildCacheableSystemPrompt({ briefing: true, includeSeo: true });

  const result = await chatJson<{
    title?: unknown;
    excerpt?: unknown;
    sections?: unknown;
    faq?: unknown;
    patchedFields?: unknown;
  }>({
    system,
    user: [
      "[에러 패치 모드 — 전면 재생성 금지]",
      "아래 원고는 이미 작성된 초고입니다. 전체를 다시 쓰지 마세요.",
      "품질 게이트에서 걸린 위반만 최소 수정으로 고친 뒤, 같은 JSON 스키마로 반환하세요.",
      "사실을 새로 만들지 마세요. 금지 표현·템플릿 문형·시제 오류·마침표 누락만 교정하세요.",
      "too-short 위반이면: 기존 고유명사·날짜·수치만으로 각 섹션에 문장 1~2개·FAQ 답을 보강해 공백 제외 1,400~1,800자에 맞추세요. 패딩·체크리스트 금지.",
      "keyword-stuffing 위반이면: 포커스 키워드를 문서 전체에서 정확히 5~6회만 남기고 줄이세요. title 1회 이하, excerpt 1회, 본문 2~3회, FAQ 전체 1회 이하로 배분하세요.",
      "소제목·표·FAQ 질문에서 포커스 키워드를 반복하지 말고, 사건명·공연명·앨범명·차트명·가수·이번 공연·해당 무대 같은 확인 가능한 대체 표현으로 바꾸세요.",
      "",
      `[포커스 키워드] ${input.keyword}`,
      "",
      "[위반 목록]",
      ...input.violations.map((item, index) => `${index + 1}. [${item.code}] ${item.detail}`),
      "",
      "[현재 초고 JSON]",
      JSON.stringify({
        title: input.draft.title,
        excerpt: input.draft.excerpt,
        sections: input.draft.sections,
        faq: input.draft.faq,
      }),
      "",
      'patchedFields에는 실제로 손본 필드명만 적으세요 (예: "excerpt","sections").',
    ].join("\n"),
    temperature: 0.3,
    timeoutMs: input.timeoutMs ?? 60_000,
    logger: input.logger,
    step: "premium-error-patch",
    provider: BRIEFING_LLM.provider,
    model: BRIEFING_LLM.draftModel(),
    promptCacheKey: premiumPromptCacheKey({
      briefing: true,
      channel: input.channel,
      mode: "patch",
    }),
    jsonSchema: ERROR_PATCH_JSON_SCHEMA,
  } satisfies ChatOptions);

  if (!result) return null;

  const title = typeof result.title === "string" && result.title.trim() ? result.title.trim() : input.draft.title;
  const excerpt =
    typeof result.excerpt === "string" && result.excerpt.trim() ? result.excerpt.trim() : input.draft.excerpt;

  let sections = input.draft.sections;
  if (Array.isArray(result.sections) && result.sections.length) {
    const parsed = result.sections.flatMap((item) => {
      const row = item as { heading?: unknown; headingLevel?: unknown; paragraphs?: unknown };
      const heading = typeof row.heading === "string" ? row.heading.trim() : "";
      const paragraphs = Array.isArray(row.paragraphs)
        ? row.paragraphs.map((p) => String(p ?? "").trim()).filter(Boolean)
        : [];
      const headingLevel = row.headingLevel === 3 ? 3 : 2;
      return heading && paragraphs.length
        ? [{ heading, headingLevel: headingLevel as 2 | 3, paragraphs }]
        : [];
    });
    if (parsed.length) sections = parsed;
  }

  let faq = input.draft.faq;
  if (Array.isArray(result.faq) && result.faq.length) {
    const parsed = result.faq.flatMap((item) => {
      const row = item as { question?: unknown; answer?: unknown };
      const question = typeof row.question === "string" ? row.question.trim() : "";
      const answer = typeof row.answer === "string" ? row.answer.trim() : "";
      return question && answer ? [{ question, answer }] : [];
    });
    if (parsed.length) faq = parsed;
  }

  const corrected = autoCorrectArticleFields({ title, excerpt, sections, faq });
  input.logger.step("premium-error-patch-applied", {
    violations: input.violations.map((item) => item.code).join(","),
    patchedFields: Array.isArray(result.patchedFields) ? result.patchedFields : [],
    beforeChars: draftPlain(input.draft).replace(/\s+/g, "").length,
    afterChars: draftPlain(corrected as PatchableDraft).replace(/\s+/g, "").length,
  });

  return {
    title: corrected.title,
    excerpt: corrected.excerpt,
    sections: corrected.sections as PatchSection[],
    faq: corrected.faq,
  };
}

/**
 * One-shot length expand for briefing floors (1,400~1,800). Uses the editor
 * model + RAG so the draft can grow without a full article regenerate.
 */
export async function expandBriefingLength(input: {
  draft: PatchableDraft;
  keyword: string;
  newsContext?: string;
  minChars: number;
  maxChars: number;
  currentChars: number;
  channel?: PostChannel;
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<PatchableDraft | null> {
  const system = buildCacheableSystemPrompt({ briefing: true, includeSeo: true });
  const result = await chatJson<{
    title?: unknown;
    excerpt?: unknown;
    sections?: unknown;
    faq?: unknown;
    patchedFields?: unknown;
  }>({
    system,
    user: [
      "[분량 보강 모드 — 전면 재생성 금지]",
      `현재 공백 제외 ${input.currentChars}자. 목표 ${input.minChars}~${input.maxChars}자.`,
      "초고 구조(title/excerpt/H2 4개=팩트→Why→How→전망/FAQ/표)는 유지하고, 각 섹션 paragraphs를 4개·문단당 3~4문장으로 채우세요.",
      "빠진 축이 있으면 RAG 팩트로만 보강: Why(왜 지금), How(독자 활용·소비 영향), 표 수치·비교, 전망·파급.",
      "아래 RAG에 있는 고유명사·날짜·수치·URL 맥락만 추가하세요. 패딩·체크리스트·일반론 금지.",
      "FAQ 답변도 각 2~3문장으로 보강하세요.",
      "포커스 키워드는 문서 전체에서 정확히 5~6회만 유지하세요. title 1회 이하, excerpt 1회, 본문 2~3회, FAQ 전체 1회 이하를 넘기지 마세요.",
      "소제목·표·FAQ 질문에서 포커스 키워드를 되풀이하지 말고, 확인 가능한 대체 표현으로 바꾸세요.",
      "",
      `[포커스 키워드] ${input.keyword}`,
      "",
      "[RAG]",
      input.newsContext?.trim() || "(없음 — 초고 팩트만 재배치)",
      "",
      "[현재 초고 JSON]",
      JSON.stringify({
        title: input.draft.title,
        excerpt: input.draft.excerpt,
        sections: input.draft.sections,
        faq: input.draft.faq,
      }),
      "",
      'patchedFields에 "sections","faq" 등 손본 필드를 적으세요.',
    ].join("\n"),
    temperature: 0.45,
    maxTokens: 8_192,
    timeoutMs: input.timeoutMs ?? 90_000,
    logger: input.logger,
    step: "premium-length-expand",
    provider: BRIEFING_LLM.provider,
    model: BRIEFING_LLM.editorModel(),
    promptCacheKey: premiumPromptCacheKey({
      briefing: true,
      channel: input.channel,
      mode: "patch",
    }),
    jsonSchema: ERROR_PATCH_JSON_SCHEMA,
  } satisfies ChatOptions);

  if (!result) return null;

  const title =
    typeof result.title === "string" && result.title.trim() ? result.title.trim() : input.draft.title;
  const excerpt =
    typeof result.excerpt === "string" && result.excerpt.trim()
      ? result.excerpt.trim()
      : input.draft.excerpt;

  let sections = input.draft.sections;
  if (Array.isArray(result.sections) && result.sections.length) {
    const parsed = result.sections.flatMap((item) => {
      const row = item as { heading?: unknown; headingLevel?: unknown; paragraphs?: unknown };
      const heading = typeof row.heading === "string" ? row.heading.trim() : "";
      const paragraphs = Array.isArray(row.paragraphs)
        ? row.paragraphs.map((p) => String(p ?? "").trim()).filter(Boolean)
        : [];
      const headingLevel = row.headingLevel === 3 ? 3 : 2;
      return heading && paragraphs.length
        ? [{ heading, headingLevel: headingLevel as 2 | 3, paragraphs }]
        : [];
    });
    if (parsed.length) sections = parsed;
  }

  let faq = input.draft.faq;
  if (Array.isArray(result.faq) && result.faq.length) {
    const parsed = result.faq.flatMap((item) => {
      const row = item as { question?: unknown; answer?: unknown };
      const question = typeof row.question === "string" ? row.question.trim() : "";
      const answer = typeof row.answer === "string" ? row.answer.trim() : "";
      return question && answer ? [{ question, answer }] : [];
    });
    if (parsed.length) faq = parsed;
  }

  const corrected = autoCorrectArticleFields({ title, excerpt, sections, faq });
  input.logger.step("premium-length-expand-applied", {
    beforeChars: input.currentChars,
    afterChars: draftPlain(corrected as PatchableDraft).replace(/\s+/g, "").length,
  });

  return {
    title: corrected.title,
    excerpt: corrected.excerpt,
    sections: corrected.sections as PatchSection[],
    faq: corrected.faq,
  };
}
