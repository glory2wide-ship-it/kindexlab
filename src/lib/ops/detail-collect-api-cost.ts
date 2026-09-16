/**
 * Detail-page info-collection API usage ledger (YouTube Data API + OpenAI).
 * Persisted under src/data/ops for /admin “상세페이지 정보수집”.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { formatKrw, usdKrwRate } from "@/lib/ops/gemini-usage";

export type DetailCollectApiCostSnapshot = {
  dayKst: string;
  youtube: {
    units: number;
    calls: number;
    /** YouTube Data API is free within daily quota; billable overage is rare. */
    estimatedKrw: number;
    estimatedKrwLabel: string;
    note: string;
  };
  openai: {
    promptTokens: number;
    completionTokens: number;
    calls: number;
    estimatedKrw: number;
    estimatedKrwLabel: string;
    note: string;
  };
  updatedAt: string;
};

type DayBucket = {
  youtubeUnits: number;
  youtubeCalls: number;
  openaiPromptTokens: number;
  openaiCompletionTokens: number;
  openaiCalls: number;
  updatedAt: string;
};

type StoreFile = {
  days: Record<string, DayBucket>;
};

const STORE_PATH = path.join(process.cwd(), "src/data/ops/detail-collect-api-cost.json");

/** Rough paid overage hint — free quota is 10,000 units/day. */
const YOUTUBE_USD_PER_1000_UNITS = 0; // free within quota; keep 0 unless overage tooling exists
/** GPT-4o-mini-ish list prices for any residual OpenAI detail calls. */
const OPENAI_INPUT_PER_M = 0.15;
const OPENAI_OUTPUT_PER_M = 0.6;

function kstDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function emptyBucket(): DayBucket {
  return {
    youtubeUnits: 0,
    youtubeCalls: 0,
    openaiPromptTokens: 0,
    openaiCompletionTokens: 0,
    openaiCalls: 0,
    updatedAt: new Date().toISOString(),
  };
}

function readStore(): StoreFile {
  try {
    if (!existsSync(STORE_PATH)) return { days: {} };
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8")) as StoreFile;
    return { days: raw.days ?? {} };
  } catch {
    return { days: {} };
  }
}

function writeStore(store: StoreFile): void {
  try {
    mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  } catch {
    /* soft on read-only FS */
  }
}

function bucketForToday(store: StoreFile): { day: string; bucket: DayBucket } {
  const day = kstDay();
  const bucket = store.days[day] ?? emptyBucket();
  store.days[day] = bucket;
  return { day, bucket };
}

/** Record YouTube Data API quota units (search≈100, channels.list≈1, etc.). */
export function recordYoutubeApiUnits(units: number, calls = 1): void {
  const amount = Math.max(0, Math.round(units));
  if (!amount) return;
  const store = readStore();
  const { bucket } = bucketForToday(store);
  bucket.youtubeUnits += amount;
  bucket.youtubeCalls += Math.max(1, calls);
  bucket.updatedAt = new Date().toISOString();
  writeStore(store);
}

/** Record OpenAI tokens used by detail/info-collection paths (if any). */
export function recordOpenAiDetailCollectUsage(input: {
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
}): void {
  const prompt = Math.max(0, Number(input.promptTokens) || 0);
  let completion = Math.max(0, Number(input.completionTokens) || 0);
  const total = Math.max(0, Number(input.totalTokens) || 0);
  if (!completion && total > prompt) completion = total - prompt;
  if (!prompt && !completion) return;
  const store = readStore();
  const { bucket } = bucketForToday(store);
  bucket.openaiPromptTokens += prompt;
  bucket.openaiCompletionTokens += completion;
  bucket.openaiCalls += 1;
  bucket.updatedAt = new Date().toISOString();
  writeStore(store);
}

export function snapshotDetailCollectApiCost(
  editionDate?: string,
): DetailCollectApiCostSnapshot {
  const day = editionDate && /^\d{4}-\d{2}-\d{2}$/.test(editionDate) ? editionDate : kstDay();
  const store = readStore();
  const bucket = store.days[day] ?? emptyBucket();
  const rate = usdKrwRate();
  const youtubeUsd = (bucket.youtubeUnits / 1000) * YOUTUBE_USD_PER_1000_UNITS;
  const openaiUsd =
    (bucket.openaiPromptTokens / 1_000_000) * OPENAI_INPUT_PER_M +
    (bucket.openaiCompletionTokens / 1_000_000) * OPENAI_OUTPUT_PER_M;
  const youtubeKrw = Math.round(youtubeUsd * rate);
  const openaiKrw = Math.round(openaiUsd * rate);

  return {
    dayKst: day,
    youtube: {
      units: bucket.youtubeUnits,
      calls: bucket.youtubeCalls,
      estimatedKrw: youtubeKrw,
      estimatedKrwLabel: formatKrw(youtubeKrw),
      note:
        bucket.youtubeUnits > 0
          ? `오늘 ${bucket.youtubeUnits.toLocaleString("ko-KR")} units · ${bucket.youtubeCalls}회 호출 (일일 무료 할당량 내 0원)`
          : "오늘 상세 정보수집 YouTube 호출 없음",
    },
    openai: {
      promptTokens: bucket.openaiPromptTokens,
      completionTokens: bucket.openaiCompletionTokens,
      calls: bucket.openaiCalls,
      estimatedKrw: openaiKrw,
      estimatedKrwLabel: formatKrw(openaiKrw),
      note:
        bucket.openaiCalls > 0
          ? `오늘 ${bucket.openaiCalls}회 · 토큰 ${(bucket.openaiPromptTokens + bucket.openaiCompletionTokens).toLocaleString("ko-KR")}`
          : "상세 정보수집 경로에서 OpenAI 미사용 (콘텐츠 생성은 Gemini)",
    },
    updatedAt: bucket.updatedAt || new Date().toISOString(),
  };
}
