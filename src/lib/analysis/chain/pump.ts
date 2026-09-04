/**
 * Optional distribution asset (shorts script). Not part of the Today's Analysis
 * happy path — briefing single-pass generation skips this extra Gemini call to
 * cut latency and API spend. Callers that still want a pump can pass facts
 * without the removed facts-LLM step.
 */
import type { FactBrief } from "@/lib/analysis/chain/facts";
import { chatJson, ANALYSIS_LLM } from "@/lib/analysis/chain/llm";
import { sanitizeParagraph } from "@/lib/analysis/chain/sanitize";
import type { AnalysisLogger } from "@/lib/analysis/log";
import { MARKET_TAPE } from "@/lib/editorial/rules";

export interface TrafficPump {
  /** Spoken lines for a ~15 second vertical short. */
  shortsScript: string[];
  /** Title for the short itself, distinct from the column headline. */
  shortsTitle: string;
  /** Pinned-comment copy that points viewers back to the article. */
  pinnedComment: string;
}

function cleanLines(raw: unknown, limit: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizeParagraph(item))
    .filter((item) => item && !MARKET_TAPE.test(item))
    .slice(0, limit);
}

export async function buildTrafficPump(input: {
  keyword: string;
  articleTitle: string;
  articleUrl: string;
  brief: FactBrief;
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<TrafficPump | null> {
  const { brief, logger } = input;

  const result = await chatJson<{
    shortsTitle?: unknown;
    shortsScript?: unknown;
    pinnedComment?: unknown;
  }>({
    // Intentionally minimal — not the column writing prompt.
    system: [
      "Write a Korean short-form script as JSON:",
      '{ "shortsTitle": string, "shortsScript": [string], "pinnedComment": string }.',
      "4-6 spoken lines, ~15 seconds total. Use only supplied facts. No 시세/순위/이모지.",
    ].join(" "),
    user: [
      `키워드: ${input.keyword}`,
      `칼럼 제목: ${input.articleTitle}`,
      `칼럼 주소: ${input.articleUrl}`,
      "",
      "확인된 팩트:",
      ...brief.facts.map((fact, index) => `${index + 1}. ${fact}`),
      brief.events.length ? `구체 고유명사: ${brief.events.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.6,
    timeoutMs: input.timeoutMs,
    logger,
    step: "step4-pump",
    model: ANALYSIS_LLM.draftModel(),
    provider: ANALYSIS_LLM.provider,
  });

  if (!result) return null;

  const shortsScript = cleanLines(result.shortsScript, 6);
  const shortsTitle =
    typeof result.shortsTitle === "string" ? sanitizeParagraph(result.shortsTitle) : "";
  const pinnedComment =
    typeof result.pinnedComment === "string" ? sanitizeParagraph(result.pinnedComment) : "";

  if (shortsScript.length < 3 || !shortsTitle || !pinnedComment) {
    logger.warn("step4-pump", { rejected: "thin pump" });
    return null;
  }

  return { shortsScript, shortsTitle, pinnedComment };
}
