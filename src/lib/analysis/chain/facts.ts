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
  "facts[0] = 사건의 배경. facts[1] = 핵심 화제 요인. facts[2] = 확인된 후속 일정·작품·장소·제도.",
  "Each fact is one Korean sentence, 30-80 characters, stated plainly.",
  "facts must be three different events. Do not restate the same birthday, quote, or reaction in another slot.",
  "Use only what the supplied articles state. Never infer, speculate, or add opinion.",
  "Never summarise crowd mood. Forbidden: 긍정적인 반응, 부정적인 반응, 생일을 축하, 뜨거운 관심, 이 소식에, 호응을 얻.",
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

const REACTION_FILLER =
  /긍정적인 반응|부정적인 반응|생일을 축하|뜨거운 관심|이 소식에|호응을 얻|긍정과 부정을 나란히/;

function clean(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item && item !== "자료 없음" && !MARKET_TAPE.test(item) && !REACTION_FILLER.test(item));
}

/** Step 1: collapse retrieved coverage into a small, checkable fact set. */
export async function summarizeFacts(input: {
  keyword: string;
  docs: NewsDoc[];
  /** Tier 0 signal lines from heatmap / ingestion — used when news is thin. */
  signalFacts?: string[];
  logger: AnalysisLogger;
  timeoutMs?: number;
}): Promise<FactBrief | null> {
  const { keyword, docs, signalFacts = [], logger } = input;
  if (docs.length === 0 && signalFacts.length < 2) {
    logger.warn("step1-facts", { skipped: "no docs or signals" });
    return null;
  }

  const signalBlock =
    signalFacts.length > 0
      ? `\n\n[실시간 신호 — 배경·맥락 근거]\n${signalFacts.map((fact, index) => `${index + 1}. ${fact}`).join("\n")}`
      : "";

  const articleBlock = docs.length > 0 ? `\n\n수집된 기사:\n\n${renderDocs(docs)}` : "";

  const result = await chatJson<{ facts?: unknown; events?: unknown }>({
    system: SYSTEM,
    user: `키워드: ${keyword}${articleBlock}${signalBlock}`,
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
