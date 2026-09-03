/**
 * Debounced Gemini Batch transport for concurrent content generators.
 *
 * When several articles await chatJson at once, requests coalesce into one
 * Batch API job (−50% vs sync). Sequential steps inside an article naturally
 * form waves (outlines → sections → repairs) via the debounce window.
 */

import {
  chatJsonLive,
  setChatJsonOverride,
  type ChatJsonFn,
  type ChatOptions,
} from "@/lib/analysis/chain/llm";
import { runGenerateContentBatch, type BatchChatRequest } from "@/lib/gemini/batch-api";

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

export class DebouncedGeminiBatchChat {
  private queue: Pending[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private seq = 0;

  constructor(
    private readonly debounceMs = Number(process.env.GEMINI_BATCH_DEBOUNCE_MS ?? 2_500),
  ) {}

  readonly chatJson: ChatJsonFn = async <T>(options: ChatOptions): Promise<T | null> => {
    // Non-Gemini forced providers stay on the live path.
    if (options.provider === "anthropic" || options.provider === "openai") {
      return chatJsonLive<T>(options);
    }

    return new Promise<T | null>((resolve, reject) => {
      this.seq += 1;
      this.queue.push({
        options: { ...options, provider: options.provider ?? "gemini" },
        customId: `req-${this.seq}-${options.step}`,
        resolve: (value) => resolve(value as T | null),
        reject,
      });
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        void this.flush();
      }, this.debounceMs);
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
          item.options.logger.step(item.options.step, {
            ok: true,
            provider: "gemini-batch",
            model: item.options.model,
            tokens: result.usage?.total_tokens,
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
 * Always flushes remaining queued calls on exit.
 */
export async function withGeminiBatchChat<T>(run: () => Promise<T>): Promise<T> {
  const transport = new DebouncedGeminiBatchChat();
  setChatJsonOverride(transport.chatJson);
  try {
    const result = await run();
    await transport.flush();
    return result;
  } finally {
    setChatJsonOverride(null);
  }
}
