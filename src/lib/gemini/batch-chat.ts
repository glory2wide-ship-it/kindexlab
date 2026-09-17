/**
 * Debounced Gemini Batch transport for concurrent content generators.
 *
 * When several articles await chatJson at once, requests coalesce into one
 * Batch API job (−50% vs sync). Sequential steps inside an article naturally
 * form waves (outlines → sections → repairs) via the debounce window.
 *
 * Hardening (2026-09-17): a hung RAG / unref'd fetch used to leave the Node
 * event loop empty after the first batch wave settled, so overnight
 * `generate-briefings` exited 0 without digest/report. We keep an explicit
 * keepalive handle for the session and always drain/reject leftovers on exit.
 */

import {
  chatJsonLive,
  setChatJsonOverride,
  type ChatJsonFn,
  type ChatOptions,
} from "@/lib/analysis/chain/llm";
import { runGenerateContentBatch, type BatchChatRequest } from "@/lib/gemini/batch-api";
import { recordGeminiUsage } from "@/lib/ops/gemini-usage";

type Pending = {
  options: ChatOptions;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  customId: string;
};

function extractJsonPayload(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

function defaultDebounceMs(): number {
  // Overnight waves RAG at uneven speeds; 2.5s flushed the first ready article
  // alone (pending=1) while siblings were still retrieving.
  return Number(process.env.GEMINI_BATCH_DEBOUNCE_MS ?? 8_000);
}

function maxQueueBeforeFlush(): number {
  const parsed = Number.parseInt(process.env.GEMINI_BATCH_MAX_QUEUE ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const overnight = Number.parseInt(process.env.BRIEFING_OVERNIGHT_BATCH_SIZE ?? "", 10);
  if (Number.isFinite(overnight) && overnight > 0) return overnight;
  return 12;
}

export class DebouncedGeminiBatchChat {
  private queue: Pending[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private seq = 0;
  /** Ref'd interval so a hung sibling promise cannot empty the event loop. */
  private keepAlive: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(
    private readonly debounceMs = defaultDebounceMs(),
    private readonly maxQueue = maxQueueBeforeFlush(),
  ) {
    this.armKeepAlive();
  }

  private armKeepAlive(): void {
    if (this.keepAlive) return;
    this.keepAlive = setInterval(() => {
      /* keepalive only */
    }, 60_000);
    // Ensure the handle is referenced even if a future Node version unrefs intervals.
    this.keepAlive.ref?.();
  }

  private clearKeepAlive(): void {
    if (!this.keepAlive) return;
    clearInterval(this.keepAlive);
    this.keepAlive = null;
  }

  private scheduleFlush(): void {
    if (this.closed) return;
    if (this.queue.length >= this.maxQueue) {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      void this.flush().catch((error) => {
        console.error("[gemini-batch] flush failed", error);
      });
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush().catch((error) => {
        console.error("[gemini-batch] flush failed", error);
      });
    }, this.debounceMs);
    this.timer.ref?.();
  }

  readonly chatJson: ChatJsonFn = async <T>(options: ChatOptions): Promise<T | null> => {
    // Non-Gemini forced providers stay on the live path.
    if (options.provider === "anthropic" || options.provider === "openai") {
      return chatJsonLive<T>(options);
    }

    if (this.closed) {
      throw new Error("Gemini batch transport closed");
    }

    return new Promise<T | null>((resolve, reject) => {
      this.seq += 1;
      this.queue.push({
        options: { ...options, provider: options.provider ?? "gemini" },
        customId: `req-${this.seq}-${options.step}`,
        resolve: (value) => resolve(value as T | null),
        reject,
      });
      this.scheduleFlush();
    });
  };

  async flush(): Promise<void> {
    if (this.flushing) {
      await this.flushing;
      if (this.queue.length) return this.flush();
      return;
    }

    const items = this.queue.splice(0, this.queue.length);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!items.length) return;

    this.flushing = this.flushItems(items).finally(() => {
      this.flushing = null;
    });
    await this.flushing;
    // Items enqueued during the await are picked up even if their debounce
    // timer was cleared when we spliced an empty-looking mid-state.
    if (this.queue.length) return this.flush();
  }

  /** Wait until the queue is empty and no flush is in flight. */
  async drain(): Promise<void> {
    for (;;) {
      await this.flush();
      if (!this.queue.length && !this.flushing) return;
    }
  }

  /** Reject anything still queued and release the keepalive handle. */
  close(reason = "Gemini batch transport closed"): void {
    this.closed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const leftover = this.queue.splice(0, this.queue.length);
    for (const item of leftover) {
      item.reject(new Error(reason));
    }
    this.clearKeepAlive();
  }

  private async flushItems(items: Pending[]): Promise<void> {
    const requests: BatchChatRequest[] = items.map((item) => ({
      customId: item.customId,
      options: item.options,
    }));

    try {
      const results = await runGenerateContentBatch(requests, {
        onStatus: (status, batchId) => {
          for (const item of items) {
            item.options.logger.step("gemini-batch", {
              status,
              batchId,
              step: item.options.step,
              pending: items.length,
            });
          }
        },
      });

      const byId = new Map(results.map((result) => [result.customId, result]));
      for (const item of items) {
        const result = byId.get(item.customId);
        if (!result?.ok || !result.content) {
          item.options.logger.warn(item.options.step, {
            reason: result?.error ?? "batch miss",
            batch: true,
          });
          item.resolve(null);
          continue;
        }
        try {
          const parsed = JSON.parse(extractJsonPayload(result.content)) as unknown;
          recordGeminiUsage({
            mode: "batch",
            model: item.options.model,
            promptTokens: result.usage?.prompt_tokens,
            completionTokens: result.usage?.completion_tokens,
            totalTokens: result.usage?.total_tokens,
          });
          item.options.logger.step(item.options.step, {
            ok: true,
            provider: "gemini-batch",
            model: item.options.model,
            tokens: result.usage?.total_tokens,
            promptTokens: result.usage?.prompt_tokens,
            completionTokens: result.usage?.completion_tokens,
          });
          item.resolve(parsed);
        } catch (error) {
          item.options.logger.warn(item.options.step, {
            reason: error instanceof Error ? error.message : "batch parse failed",
          });
          item.resolve(null);
        }
      }
    } catch (error) {
      // Fall back to live chat so a Batch outage does not wipe the edition.
      for (const item of items) {
        item.options.logger.warn("gemini-batch-fallback", {
          reason: error instanceof Error ? error.message : "batch failed",
          step: item.options.step,
        });
        try {
          const live = await chatJsonLive(item.options);
          item.resolve(live);
        } catch (liveError) {
          item.reject(liveError);
        }
      }
    }
  }
}

/**
 * Installs the Gemini Batch chat transport for the duration of `run`.
 * Always drains remaining queued calls on exit and keeps the event loop alive
 * for the whole session so a hung sibling cannot exit the process early.
 */
export async function withGeminiBatchChat<T>(run: () => Promise<T>): Promise<T> {
  const transport = new DebouncedGeminiBatchChat();
  setChatJsonOverride(transport.chatJson);
  try {
    const result = await run();
    await transport.drain();
    return result;
  } finally {
    setChatJsonOverride(null);
    try {
      await transport.drain();
    } catch {
      /* drain best-effort on shutdown */
    }
    transport.close();
  }
}
