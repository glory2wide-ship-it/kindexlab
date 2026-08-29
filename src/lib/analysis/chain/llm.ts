import type { AnalysisLogger } from "@/lib/analysis/log";

export interface ChatOptions {
  system: string;
  user: string;
  temperature?: number;
  /** Aborts the request; the caller falls back rather than hanging a render. */
  timeoutMs?: number;
  logger: AnalysisLogger;
  step: string;
  model?: string;
}

export function llmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Extraction and drafting run on the cheap model; the editor pass runs on the
 * stronger one because tone repair and length discipline are where the small
 * model measurably under-performs.
 */
export function draftModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

export function editorModel(): string {
  return process.env.OPENAI_EDITOR_MODEL || "gpt-4o";
}

/** Model label recorded on the cached entry. */
export function llmModel(): string {
  return `${draftModel()}+${editorModel()}`;
}

/** Rate-limit retries. Batched rebuilds burst well past the per-minute quota. */
const MAX_RETRIES = 3;

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
const MAX_INFLIGHT = Number.parseInt(process.env.OPENAI_MAX_CONCURRENCY ?? "", 10) || 6;

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
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 30_000);
  return Math.min(1_000 * 2 ** attempt, 30_000);
}

export async function chatJson<T>(options: ChatOptions): Promise<T | null> {
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

  try {
    let response: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: options.model ?? draftModel(),
          temperature: options.temperature ?? 0.4,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: options.system },
            { role: "user", content: options.user },
          ],
        }),
      });

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
      });
      return null;
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) {
      options.logger.warn(options.step, { reason: "empty completion" });
      return null;
    }

    const parsed = JSON.parse(raw) as T;
    options.logger.step(options.step, {
      ok: true,
      model: options.model ?? draftModel(),
      ms: Date.now() - startedAt,
      tokens: json.usage?.total_tokens,
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
