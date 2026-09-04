import type { AnalysisLogger } from "@/lib/analysis/log";

export type LlmProvider = "openai" | "anthropic" | "gemini";

export interface ChatOptions {
  system: string;
  user: string;
  temperature?: number;
  /** OpenAI/Anthropic/Gemini completion budget. Default leaves provider default. */
  maxTokens?: number;
  /** Aborts the request; the caller falls back rather than hanging a render. */
  timeoutMs?: number;
  logger: AnalysisLogger;
  step: string;
  model?: string;
  /**
   * Force a backend regardless of LLM_PROVIDER.
   * Daily briefing / deep-dive generation uses BRIEFING_LLM.provider.
   */
  provider?: LlmProvider;
  /**
   * OpenAI prompt-cache routing key. Requests that share a long stable system
   * prefix should reuse the same key (bucketed by channel/mode) so cache hits
   * land on the same machine. Ignored by Anthropic / Gemini.
   */
  promptCacheKey?: string;
  /**
   * Structured JSON schema. OpenAI uses json_schema strict mode; Gemini maps
   * the same schema into responseMimeType + responseSchema.
   */
  jsonSchema?: {
    name: string;
    strict: true;
    schema: Record<string, unknown>;
  };
}

export type ChatJsonFn = <T>(options: ChatOptions) => Promise<T | null>;

/** Optional override used by the overnight Gemini / OpenAI Batch transport. */
let chatJsonOverride: ChatJsonFn | null = null;

export function setChatJsonOverride(fn: ChatJsonFn | null): void {
  chatJsonOverride = fn;
}

function envFlagTrue(value: string | undefined): boolean {
  const flag = value?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/** @deprecated Prefer geminiBatchEnabled — OpenAI is no longer used for content gen. */
export function openaiBatchEnabled(): boolean {
  return envFlagTrue(process.env.OPENAI_USE_BATCH);
}

/** Overnight / cron content jobs: coalesce chatJson into Gemini Batch (−50%). */
export function geminiBatchEnabled(): boolean {
  if (envFlagTrue(process.env.GEMINI_USE_BATCH)) return true;
  // Shared alias so one flag can drive whichever provider is active.
  if (envFlagTrue(process.env.LLM_USE_BATCH)) return true;
  return false;
}

/**
 * All article / board / premium / 오늘의 분석 generation defaults to Gemini.
 * Set LLM_PROVIDER=anthropic only for an explicit alternate.
 * LLM_PROVIDER=openai is ignored (legacy env) — content gen never uses OpenAI.
 */
export function llmProvider(): LlmProvider {
  const forced = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (forced === "anthropic") return "anthropic";
  // openai override is ignored for content generation — always Gemini unless anthropic.
  if (forced === "openai") return "gemini";
  if (forced === "gemini") return "gemini";
  if (process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) return "anthropic";
  return "gemini";
}

export function resolveLlmProvider(options?: Pick<ChatOptions, "provider">): LlmProvider {
  return options?.provider ?? llmProvider();
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function llmConfigured(): boolean {
  const provider = llmProvider();
  if (provider === "gemini") return geminiConfigured();
  if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return openaiConfigured();
}

/** Briefing / deep-dive articles use Gemini by default (override via BRIEFING_LLM_PROVIDER). */
export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function briefingLlmConfigured(): boolean {
  const provider = briefingProvider();
  if (provider === "gemini") return geminiConfigured();
  if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return openaiConfigured();
}

/**
 * Extraction and drafting run on the cheap model; the editor pass runs on the
 * stronger one because tone repair and length discipline are where the small
 * model measurably under-performs.
 */
export function openaiDraftModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

export function openaiEditorModel(): string {
  return process.env.OPENAI_EDITOR_MODEL || "gpt-4o";
}

export function geminiDraftModel(): string {
  return process.env.GEMINI_MODEL || process.env.GEMINI_DRAFT_MODEL || "gemini-3.6-flash";
}

export function geminiEditorModel(): string {
  return process.env.GEMINI_EDITOR_MODEL || process.env.GEMINI_MODEL || "gemini-3.6-flash";
}

export function draftModel(provider: LlmProvider = llmProvider()): string {
  if (provider === "anthropic") {
    return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  }
  if (provider === "gemini") return geminiDraftModel();
  return openaiDraftModel();
}

export function editorModel(provider: LlmProvider = llmProvider()): string {
  if (provider === "anthropic") {
    return (
      process.env.ANTHROPIC_EDITOR_MODEL ||
      process.env.ANTHROPIC_MODEL ||
      "claude-sonnet-5"
    );
  }
  if (provider === "gemini") return geminiEditorModel();
  return openaiEditorModel();
}

/** Model label recorded on the cached entry. */
export function llmModel(): string {
  return `${draftModel()}+${editorModel()}`;
}

/**
 * Provider for daily briefing / category deep-dive / premium columns.
 * Default is Gemini. Set BRIEFING_LLM_PROVIDER=anthropic only for an explicit alternate.
 */
export function briefingProvider(): LlmProvider {
  const forced = (process.env.BRIEFING_LLM_PROVIDER || "").trim().toLowerCase();
  if (forced === "anthropic" || forced === "gemini") {
    return forced;
  }
  // openai override is ignored for content generation — always Gemini unless anthropic.
  if (forced === "openai") return "gemini";
  return "gemini";
}

/** Fixed provider + models for daily briefing / category deep-dive generation. */
export const BRIEFING_LLM = {
  get provider(): LlmProvider {
    return briefingProvider();
  },
  draftModel: () => draftModel(briefingProvider()),
  editorModel: () => editorModel(briefingProvider()),
};

/**
 * Provider for heatmap detail "오늘의 분석".
 * Same Gemini path as 일일 브리핑 (`generatePremiumArticle` single-pass).
 * Never OpenAI, even if LLM_PROVIDER=openai remains in .env.
 */
export function analysisProvider(): LlmProvider {
  const forced = (process.env.ANALYSIS_LLM_PROVIDER || "").trim().toLowerCase();
  if (forced === "anthropic") return "anthropic";
  return "gemini";
}

export function analysisLlmConfigured(): boolean {
  const provider = analysisProvider();
  if (provider === "gemini") return geminiConfigured();
  if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return false;
}

/** Fixed provider + models for 오늘의 분석 (aligned with BRIEFING_LLM). */
export const ANALYSIS_LLM = {
  get provider(): LlmProvider {
    return analysisProvider();
  },
  draftModel: () => draftModel(analysisProvider()),
  editorModel: () => editorModel(analysisProvider()),
};

/** Rate-limit retries. Batched rebuilds burst well past the per-minute quota. */
const MAX_RETRIES = 5;

/**
 * Ceiling on in-flight completions across the process.
 *
 * A rebuild batch of five articles, each fanning out to five section calls,
 * puts twenty-five requests on the wire at once. The account's per-minute quota
 * refuses most of them, and retrying a rejected burst just re-creates the
 * burst — the articles that lost the race come back short a section or with an
 * unrepaired draft. Queueing at the source keeps throughput roughly the same
 * while every call actually lands.
 */
const MAX_INFLIGHT =
  Number.parseInt(
    process.env.GEMINI_MAX_CONCURRENCY ?? process.env.OPENAI_MAX_CONCURRENCY ?? "",
    10,
  ) || 6;

let inflight = 0;
const waiting: (() => void)[] = [];

async function acquireSlot(): Promise<void> {
  if (inflight < MAX_INFLIGHT) {
    inflight += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  inflight += 1;
}

function releaseSlot(): void {
  inflight -= 1;
  waiting.shift()?.();
}

/**
 * One JSON-mode chat completion. Returns null on any failure (missing key,
 * timeout, non-200, unparseable body) so every step in the chain degrades to
 * the deterministic composer instead of throwing into a page render.
 */

function retryDelayMs(response: Response, attempt: number): number {
  // Honour the server's own pacing when it sends one; otherwise back off
  // exponentially from one second.
  const header = response.headers.get("retry-after");
  const seconds = header ? Number.parseFloat(header) : Number.NaN;
  const base = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1_000 * 2 ** attempt;

  // Jitter, because the callers arrive in lockstep. An article fans out to five
  // section calls at once; when the quota rejects them they all read the same
  // `retry-after`, sleep the same 4s and re-fire together, which is the burst
  // that was refused in the first place. Spreading the wake-ups over the window
  // lets them land one after another instead of colliding again.
  return Math.min(base, 30_000) * (0.5 + Math.random());
}

function extractJsonPayload(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

async function chatJsonAnthropic<T>(options: ChatOptions): Promise<T | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    options.logger.warn(options.step, { skipped: "no ANTHROPIC_API_KEY" });
    return null;
  }

  const startedAt = Date.now();
  await acquireSlot();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);

  try {
    let response: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: options.model ?? draftModel("anthropic"),
          max_tokens: 16_384,
          system: `${options.system}\n\nRespond with one valid JSON object only. No markdown fences or commentary.`,
          messages: [{ role: "user", content: options.user }],
        }),
      });

      if (response.status !== 429 && response.status < 500) break;
      if (attempt === MAX_RETRIES) break;

      const wait = retryDelayMs(response, attempt);
      options.logger.warn(options.step, {
        status: response.status,
        retryIn: `${wait}ms`,
        attempt: attempt + 1,
      });
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    if (!response || !response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response?.clone().json();
      } catch {
        errorBody = undefined;
      }
      options.logger.warn(options.step, {
        status: response?.status ?? "no response",
        ms: Date.now() - startedAt,
        provider: "anthropic",
        error: errorBody,
      });
      return null;
    }

    const json = (await response.json()) as {
      content?: { type?: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const raw = json.content?.find((block) => block.type === "text")?.text;
    if (!raw) {
      options.logger.warn(options.step, { reason: "empty completion" });
      return null;
    }

    const parsed = JSON.parse(extractJsonPayload(raw)) as T;
    options.logger.step(options.step, {
      ok: true,
      provider: "anthropic",
      model: options.model ?? draftModel("anthropic"),
      ms: Date.now() - startedAt,
      tokens: (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0),
    });
    return parsed;
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    options.logger.warn(options.step, {
      reason: aborted ? "timeout" : error instanceof Error ? error.message : "failed",
      ms: Date.now() - startedAt,
    });
    return null;
  } finally {
    clearTimeout(timer);
    releaseSlot();
  }
}

export async function chatJson<T>(options: ChatOptions): Promise<T | null> {
  if (chatJsonOverride) return chatJsonOverride<T>(options);
  return chatJsonLive<T>(options);
}

/** Direct provider call that ignores any Batch / test override. */
export async function chatJsonLive<T>(options: ChatOptions): Promise<T | null> {
  const provider = resolveLlmProvider(options);
  if (provider === "anthropic") return chatJsonAnthropic<T>(options);
  if (provider === "gemini") return chatJsonGemini<T>(options);
  return chatJsonOpenAi<T>(options);
}

async function chatJsonGemini<T>(options: ChatOptions): Promise<T | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    options.logger.warn(options.step, { skipped: "no GEMINI_API_KEY" });
    return null;
  }

  const startedAt = Date.now();
  await acquireSlot();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);
  const model = options.model ?? draftModel("gemini");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  try {
    let response: Response | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const generationConfig: Record<string, unknown> = {
        temperature: options.temperature ?? 0.4,
        maxOutputTokens: options.maxTokens ?? 8_192,
        responseMimeType: "application/json",
      };

      const userText = options.jsonSchema
        ? `${options.user}\n\n[출력] 지정 JSON 스키마 키만 포함한 완전 JSON 객체 하나만 반환하세요. 코드블록 금지.`
        : options.user;

      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: options.system }] },
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig,
        }),
      });

      if (response.status !== 429 && response.status < 500) break;
      if (attempt === MAX_RETRIES) break;

      const wait = retryDelayMs(response, attempt);
      options.logger.warn(options.step, {
        status: response.status,
        retryIn: `${wait}ms`,
        attempt: attempt + 1,
      });
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    if (!response || !response.ok) {
      let detail = "";
      try {
        detail = (await response?.text())?.slice(0, 240) ?? "";
      } catch {
        detail = "";
      }
      options.logger.warn(options.step, {
        status: response?.status ?? "no response",
        ms: Date.now() - startedAt,
        provider: "gemini",
        detail,
      });
      return null;
    }

    const json = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
      error?: { message?: string };
    };

    const raw = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!raw.trim()) {
      options.logger.warn(options.step, {
        reason: "empty completion",
        finishReason: json.candidates?.[0]?.finishReason,
        error: json.error?.message,
      });
      return null;
    }

    let parsed: T;
    try {
      parsed = JSON.parse(extractJsonPayload(raw)) as T;
    } catch (parseError) {
      options.logger.warn(options.step, {
        reason: "json-parse",
        finishReason: json.candidates?.[0]?.finishReason,
        error: parseError instanceof Error ? parseError.message : "parse failure",
        rawChars: raw.length,
      });
      return null;
    }

    options.logger.step(options.step, {
      ok: true,
      provider: "gemini",
      model,
      ms: Date.now() - startedAt,
      tokens: json.usageMetadata?.totalTokenCount,
      promptTokens: json.usageMetadata?.promptTokenCount,
      completionTokens: json.usageMetadata?.candidatesTokenCount,
      finishReason: json.candidates?.[0]?.finishReason,
    });
    return parsed;
  } catch (error) {
    options.logger.warn(options.step, {
      error: error instanceof Error ? error.message : "gemini failure",
      ms: Date.now() - startedAt,
    });
    return null;
  } finally {
    clearTimeout(timer);
    releaseSlot();
  }
}

async function chatJsonOpenAi<T>(options: ChatOptions): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    options.logger.warn(options.step, { skipped: "no OPENAI_API_KEY" });
    return null;
  }

  const startedAt = Date.now();
  await acquireSlot();

  // The timeout starts once the call is actually admitted, so a request that
  // waited in the queue still gets its full budget.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);
  const model = options.model ?? draftModel("openai");

  try {
    let response: Response | null = null;
    let jsonSchema = options.jsonSchema;
    let schemaFallbackTried = false;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: options.temperature ?? 0.4,
          max_tokens: options.maxTokens ?? 8_192,
          response_format: jsonSchema
            ? {
                type: "json_schema",
                json_schema: jsonSchema,
              }
            : { type: "json_object" },
          messages: [
            { role: "system", content: options.system },
            { role: "user", content: options.user },
          ],
          ...(options.promptCacheKey
            ? { prompt_cache_key: options.promptCacheKey }
            : {}),
        }),
      });

      // Structured Outputs unsupported / invalid schema → one json_object retry in-slot.
      if (
        jsonSchema &&
        !schemaFallbackTried &&
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
        schemaFallbackTried = true;
        jsonSchema = undefined;
        options.logger.warn(options.step, {
          structuredOutputsFallback: "json_object",
          status: response.status,
        });
        attempt -= 1;
        continue;
      }

      // 429 and 5xx are transient; anything else is a decision, not a hiccup.
      if (response.status !== 429 && response.status < 500) break;
      if (attempt === MAX_RETRIES) break;

      const wait = retryDelayMs(response, attempt);
      options.logger.warn(options.step, {
        status: response.status,
        retryIn: `${wait}ms`,
        attempt: attempt + 1,
      });
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    if (!response || !response.ok) {
      options.logger.warn(options.step, {
        status: response?.status ?? "no response",
        ms: Date.now() - startedAt,
        provider: "openai",
      });
      return null;
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: {
        total_tokens?: number;
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
      };
    };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) {
      options.logger.warn(options.step, { reason: "empty completion" });
      return null;
    }

    const parsed = JSON.parse(raw) as T;
    const cachedTokens = json.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    options.logger.step(options.step, {
      ok: true,
      provider: "openai",
      model,
      ms: Date.now() - startedAt,
      tokens: json.usage?.total_tokens,
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
      cachedTokens,
      finishReason: json.choices?.[0]?.finish_reason,
      promptCacheKey: options.promptCacheKey,
    });
    return parsed;
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    options.logger.warn(options.step, {
      reason: aborted ? "timeout" : error instanceof Error ? error.message : "failed",
      ms: Date.now() - startedAt,
    });
    return null;
  } finally {
    clearTimeout(timer);
    releaseSlot();
  }
}
