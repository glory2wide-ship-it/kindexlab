import { BRIEFING_LLM } from "@/lib/analysis/chain/llm";
import type { BriefingGenerationMode } from "@/lib/premium/briefing-editorial";

/** LLM step inside the premium / briefing generator. */
export type BriefingLlmStep = "article" | "patch" | "decliche";

export type SmartRouteTier = "economy" | "hybrid" | "premium";

/**
 * Maps generation mode → cost tier.
 * Single-pass Gemini briefing: one model for the full article; economy for thin shorts.
 */
export function briefingRouteTier(
  mode: BriefingGenerationMode | undefined,
  briefing?: boolean,
): SmartRouteTier {
  if (!briefing) return "premium";
  if (mode === "shorts") return "economy";
  if (mode === "sparse") return "hybrid";
  return "premium";
}

/**
 * Picks the OpenAI model for one generator step.
 * Single-pass article uses editor on full/hybrid, mini on shorts.
 */
export function resolveBriefingModel(input: {
  briefing?: boolean;
  mode?: BriefingGenerationMode;
  step: BriefingLlmStep;
}): string {
  const forced = process.env.OPENAI_BRIEFING_FORCE_MODEL?.trim();
  if (forced) return forced;

  const draft = BRIEFING_LLM.draftModel();
  const editor = BRIEFING_LLM.editorModel();
  const tier = briefingRouteTier(input.mode, input.briefing);

  if (tier === "economy") return draft;
  if (input.step === "patch" || input.step === "decliche") return draft;
  if (tier === "hybrid") return draft;
  return editor;
}

export function describeSmartRoute(input: {
  briefing?: boolean;
  mode?: BriefingGenerationMode;
}): { tier: SmartRouteTier; draft: string; editor: string } {
  return {
    tier: briefingRouteTier(input.mode, input.briefing),
    draft: BRIEFING_LLM.draftModel(),
    editor: BRIEFING_LLM.editorModel(),
  };
}
