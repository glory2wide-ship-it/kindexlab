import type { FactBrief } from "@/lib/analysis/chain/facts";
import { chatJson, draftModel } from "@/lib/analysis/chain/llm";
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

const SYSTEM = [
  "You write short-form video scripts in Korean for a trend magazine channel.",
  "Output JSON: { \"shortsTitle\": string, \"shortsScript\": [string], \"pinnedComment\": string }.",
  "shortsScript is 4 to 6 spoken lines. Read aloud the whole thing must last about 15 seconds, so keep each line under 45 Korean characters.",
  "Line 1 is a hook that makes someone stop scrolling. The middle lines deliver the facts. The last line points to the full article.",
  "shortsTitle is under 40 characters and contains the keyword.",
  "pinnedComment is one or two sentences inviting viewers to read the full column, written as a person, not an ad.",
  "Use only the supplied facts. Never invent an event, a date, or a quote.",
  "Never mention 시세, 등락, 거래량, 순위, 차트, 가격.",
  "No hashtags, no emoji, no all-caps.",
].join(" ");

function cleanLines(raw: unknown, limit: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizeParagraph(item))
    .filter((item) => item && !MARKET_TAPE.test(item))
    .slice(0, limit);
}

/**
 * Step 4: the distribution asset. Generated from the same fact brief as the
 * column so the short never claims something the article does not support.
 * Failure is non-fatal — the column publishes without it.
 */
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
    system: SYSTEM,
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
    model: draftModel(),
  });

  if (!result) return null;

  const shortsScript = cleanLines(result.shortsScript, 6);
  const shortsTitle =
    typeof result.shortsTitle === "string" ? sanitizeParagraph(result.shortsTitle) : "";
  const pinnedComment =
    typeof result.pinnedComment === "string" ? sanitizeParagraph(result.pinnedComment) : "";

  if (shortsScript.length < 3 || !shortsTitle || !pinnedComment) {
    logger.warn("step4-pump", { reason: "incomplete", lines: shortsScript.length });
    return null;
  }

  logger.step("step4-pump", {
    lines: shortsScript.length,
    chars: shortsScript.join("").length,
  });
  return { shortsTitle, shortsScript, pinnedComment };
}
