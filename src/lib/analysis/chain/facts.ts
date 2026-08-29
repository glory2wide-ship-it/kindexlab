import { chatJson } from "@/lib/analysis/chain/llm";
import type { AnalysisLogger } from "@/lib/analysis/log";
import { MARKET_TAPE } from "@/lib/editorial/rules";
import type { NewsDoc } from "@/lib/news/types";

export interface FactBrief {
  /** Exactly three fact lines: background, why topical, public reaction. */
  facts: string[];
  /** Concrete event names or dates the draft may cite. */
  events: string[];
  /** Outlets the facts came from, for provenance. */
  publishers: string[];
}

const SYSTEM = [
  "You extract verifiable facts from Korean news headlines and snippets.",
  "Output JSON: { \"facts\": [3 strings], \"events\": [strings] }.",
  "facts[0] = 사건의 배경. facts[1] = 핵심 화제 요인. facts[2] = 대중 반응.",
  "Each fact is one Korean sentence, 30-80 characters, stated plainly.",
  "Use only what the supplied articles state. Never infer, speculate, or add opinion.",
  "events = concrete proper nouns the articles mention: 작품명, 프로그램명, 행사명, 날짜, 소속사, 인물명.",
  "Absolutely forbidden anywhere in the output: 시세, 등락, 거래량, 순위, 1위, 차트, 가격, 조회수, 지수, 퍼센트 수치.",
  "If the articles do not support a fact, write 자료 없음 for that slot rather than inventing one.",
].join(" ");

function renderDocs(docs: NewsDoc[]): string {
  return docs
    .map((doc, index) => {
      const parts = [`[${index + 1}] ${doc.title}`];
      if (doc.publisher) parts.push(`매체: ${doc.publisher}`);
      if (doc.publishedAt) parts.push(`시각: ${doc.publishedAt}`);
      if (doc.snippet) parts.push(`요약: ${doc.snippet}`);
      return parts.join("\n");
    })
    .join("\n\n");
}

function clean(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item && item !== "자료 없음" && !MARKET_TAPE.test(item));
}

/** Step 1: collapse retrieved coverage into a small, checkable fact set. */
export async function summarizeFacts(input: {
  keyword: string;
  docs: NewsDoc[];
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<FactBrief | null> {
  const { keyword, docs, logger } = input;
  if (docs.length === 0) {
    logger.warn("step1-facts", { skipped: "no docs" });
    return null;
  }

  const result = await chatJson<{ facts?: unknown; events?: unknown }>({
    system: SYSTEM,
    user: `키워드: ${keyword}\n\n수집된 기사:\n\n${renderDocs(docs)}`,
    temperature: 0.2,
    timeoutMs: input.timeoutMs,
    logger,
    step: "step1-facts",
  });

  if (!result) return null;

  const facts = clean(result.facts);
  const events = clean(result.events).slice(0, 8);
  if (facts.length < 2) {
    logger.warn("step1-facts", { reason: "too few usable facts", got: facts.length });
    return null;
  }

  const publishers = [...new Set(docs.map((doc) => doc.publisher).filter(Boolean))] as string[];
  logger.step("step1-facts", { facts: facts.length, events: events.length });
  for (const fact of facts) logger.detail(`· ${fact}`);

  return { facts, events, publishers };
}
