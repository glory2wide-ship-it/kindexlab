/**
 * Process-wide Gemini token ledger for overnight generation cost reports.
 *
 * Prices follow Gemini Developer API paid tier for `gemini-3.6-flash`
 * (https://ai.google.dev/gemini-api/docs/pricing):
 *   Live  input $1.50 / output $7.50 per 1M tokens
 *   Batch input $0.75 / output $3.75 per 1M tokens (−50%)
 *
 * Reports display 원화(KRW). USD list prices are converted with
 * `REPORT_USD_KRW_RATE` (default 1,400).
 */

export type GeminiBillingMode = "live" | "batch";

export interface GeminiUsageRecord {
  model: string;
  mode: GeminiBillingMode;
  promptTokens: number;
  completionTokens: number;
  calls: number;
}

export interface GeminiUsageSnapshot {
  model: string;
  live: GeminiUsageRecord;
  batch: GeminiUsageRecord;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  calls: number;
  estimatedUsd: number;
  liveUsd: number;
  batchUsd: number;
  estimatedKrw: number;
  liveKrw: number;
  batchKrw: number;
  usdKrwRate: number;
  pricingNote: string;
}

const LIVE_INPUT_PER_M = 1.5;
const LIVE_OUTPUT_PER_M = 7.5;
const BATCH_INPUT_PER_M = 0.75;
const BATCH_OUTPUT_PER_M = 3.75;
/** Fallback FX when REPORT_USD_KRW_RATE is unset. */
const DEFAULT_USD_KRW_RATE = 1_400;

const empty = (mode: GeminiBillingMode, model = "gemini-3.6-flash"): GeminiUsageRecord => ({
  model,
  mode,
  promptTokens: 0,
  completionTokens: 0,
  calls: 0,
});

let live = empty("live");
let batch = empty("batch");
let lastModel = "gemini-3.6-flash";

export function usdKrwRate(): number {
  const parsed = Number.parseFloat(process.env.REPORT_USD_KRW_RATE ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USD_KRW_RATE;
}

export function resetGeminiUsage(model = "gemini-3.6-flash"): void {
  lastModel = model || "gemini-3.6-flash";
  live = empty("live", lastModel);
  batch = empty("batch", lastModel);
}

export function recordGeminiUsage(input: {
  mode: GeminiBillingMode;
  model?: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
}): void {
  const model = input.model?.trim() || lastModel;
  lastModel = model;
  const prompt = Math.max(0, Number(input.promptTokens) || 0);
  let completion = Math.max(0, Number(input.completionTokens) || 0);
  const total = Math.max(0, Number(input.totalTokens) || 0);
  if (!completion && total > prompt) completion = total - prompt;
  if (!prompt && !completion && !total) return;

  const bucket = input.mode === "batch" ? batch : live;
  bucket.model = model;
  bucket.promptTokens += prompt;
  bucket.completionTokens += completion;
  bucket.calls += 1;
}

function usdFor(record: GeminiUsageRecord): number {
  const inputRate = record.mode === "batch" ? BATCH_INPUT_PER_M : LIVE_INPUT_PER_M;
  const outputRate = record.mode === "batch" ? BATCH_OUTPUT_PER_M : LIVE_OUTPUT_PER_M;
  return (record.promptTokens / 1_000_000) * inputRate + (record.completionTokens / 1_000_000) * outputRate;
}

export function snapshotGeminiUsage(): GeminiUsageSnapshot {
  const liveUsd = usdFor(live);
  const batchUsd = usdFor(batch);
  const rate = usdKrwRate();
  const liveKrw = liveUsd * rate;
  const batchKrw = batchUsd * rate;
  return {
    model: lastModel,
    live: { ...live },
    batch: { ...batch },
    promptTokens: live.promptTokens + batch.promptTokens,
    completionTokens: live.completionTokens + batch.completionTokens,
    totalTokens: live.promptTokens + live.completionTokens + batch.promptTokens + batch.completionTokens,
    calls: live.calls + batch.calls,
    liveUsd,
    batchUsd,
    estimatedUsd: liveUsd + batchUsd,
    liveKrw,
    batchKrw,
    estimatedKrw: liveKrw + batchKrw,
    usdKrwRate: rate,
    pricingNote: `추정 비용(원화) · USD→KRW ${rate.toLocaleString("ko-KR")}원 적용 · Gemini Developer API (gemini-3.6-flash) Live $1.50/$7.50 · Batch $0.75/$3.75 per 1M tokens.`,
  };
}

/** @deprecated Prefer formatKrw for reader-facing reports. */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "$0.0000";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

/** Reader-facing cost unit: Korean Won. */
export function formatKrw(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "₩0";
  const rounded = amount < 1 ? Math.ceil(amount) : Math.round(amount);
  return `₩${rounded.toLocaleString("ko-KR")}`;
}

export function usdToKrw(usd: number): number {
  return Math.max(0, usd) * usdKrwRate();
}

export function usageDelta(before: GeminiUsageSnapshot, after: GeminiUsageSnapshot): number {
  return Math.max(0, after.estimatedUsd - before.estimatedUsd);
}
