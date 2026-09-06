/**
 * OpenAI Batch API client (−50% vs sync chat completions).
 *
 * Used for overnight / cron briefing runs when OPENAI_USE_BATCH=1.
 * @see https://platform.openai.com/docs/guides/batch
 */

import type { ChatOptions } from "@/lib/analysis/chain/llm";

const BATCH_API = "https://api.openai.com/v1";

export interface BatchChatRequest {
  customId: string;
  options: Omit<ChatOptions, "logger"> & { logger?: ChatOptions["logger"] };
}

export interface BatchChatResult {
  customId: string;
  ok: boolean;
  content?: string;
  error?: string;
  usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    cached_tokens?: number;
  };
}

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is required for Batch API");
  return key;
}

function buildCompletionBody(options: BatchChatRequest["options"]): Record<string, unknown> {
  const model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  return {
    model,
    temperature: options.temperature ?? 0.4,
    response_format: options.jsonSchema
      ? { type: "json_schema", json_schema: options.jsonSchema }
      : { type: "json_object" },
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
    ...(options.promptCacheKey ? { prompt_cache_key: options.promptCacheKey } : {}),
  };
}

/** Builds JSONL lines for /v1/chat/completions batch input. */
export function buildChatCompletionsJsonl(requests: BatchChatRequest[]): string {
  return requests
    .map((request) =>
      JSON.stringify({
        custom_id: request.customId,
        method: "POST",
        url: "/v1/chat/completions",
        body: buildCompletionBody(request.options),
      }),
    )
    .join("\n");
}

async function uploadBatchFile(jsonl: string): Promise<string> {
  const form = new FormData();
  form.append("purpose", "batch");
  form.append("file", new Blob([jsonl], { type: "application/jsonl" }), "briefing-batch.jsonl");

  const response = await fetch(`${BATCH_API}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Batch file upload failed: ${response.status} ${await response.text()}`);
  }
  const json = (await response.json()) as { id?: string };
  if (!json.id) throw new Error("Batch file upload returned no id");
  return json.id;
}

async function createBatch(fileId: string): Promise<string> {
  const response = await fetch(`${BATCH_API}/batches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input_file_id: fileId,
      endpoint: "/v1/chat/completions",
      completion_window: "24h",
      metadata: { source: "kindexlab-briefing" },
    }),
  });
  if (!response.ok) {
    throw new Error(`Batch create failed: ${response.status} ${await response.text()}`);
  }
  const json = (await response.json()) as { id?: string };
  if (!json.id) throw new Error("Batch create returned no id");
  return json.id;
}

async function getBatch(batchId: string): Promise<{
  status: string;
  output_file_id?: string;
  error_file_id?: string;
}> {
  const response = await fetch(`${BATCH_API}/batches/${batchId}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!response.ok) {
    throw new Error(`Batch poll failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as {
    status: string;
    output_file_id?: string;
    error_file_id?: string;
  };
}

async function downloadFileText(fileId: string): Promise<string> {
  const response = await fetch(`${BATCH_API}/files/${fileId}/content`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!response.ok) {
    throw new Error(`Batch file download failed: ${response.status}`);
  }
  return response.text();
}

function parseOutputJsonl(text: string): BatchChatResult[] {
  const results: BatchChatResult[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as {
        custom_id?: string;
        response?: {
          status_code?: number;
          body?: {
            choices?: { message?: { content?: string } }[];
            usage?: {
              total_tokens?: number;
              prompt_tokens?: number;
              completion_tokens?: number;
              prompt_tokens_details?: { cached_tokens?: number };
            };
            error?: { message?: string };
          };
        };
        error?: { message?: string };
      };
      const customId = row.custom_id ?? "";
      const body = row.response?.body;
      const content = body?.choices?.[0]?.message?.content;
      if (content && (row.response?.status_code ?? 200) < 400) {
        results.push({
          customId,
          ok: true,
          content,
          usage: {
            total_tokens: body?.usage?.total_tokens,
            prompt_tokens: body?.usage?.prompt_tokens,
            completion_tokens: body?.usage?.completion_tokens,
            cached_tokens: body?.usage?.prompt_tokens_details?.cached_tokens,
          },
        });
      } else {
        results.push({
          customId,
          ok: false,
          error: body?.error?.message ?? row.error?.message ?? "batch item failed",
        });
      }
    } catch {
      results.push({ customId: "", ok: false, error: "invalid batch output line" });
    }
  }
  return results;
}

/**
 * Submits chat-completion requests as one Batch job and waits until completed
 * (or until maxWaitMs). Returns results keyed by custom_id order of input.
 */
export async function runChatCompletionsBatch(
  requests: BatchChatRequest[],
  options?: {
    pollIntervalMs?: number;
    maxWaitMs?: number;
    onStatus?: (status: string, batchId: string) => void;
  },
): Promise<BatchChatResult[]> {
  if (!requests.length) return [];

  const pollIntervalMs = options?.pollIntervalMs ?? 15_000;
  const maxWaitMs = options?.maxWaitMs ?? Number(process.env.OPENAI_BATCH_MAX_WAIT_MS ?? 5 * 60 * 60 * 1000);

  const jsonl = buildChatCompletionsJsonl(requests);
  const fileId = await uploadBatchFile(jsonl);
  const batchId = await createBatch(fileId);
  options?.onStatus?.("validating", batchId);

  const started = Date.now();
  for (;;) {
    const batch = await getBatch(batchId);
    options?.onStatus?.(batch.status, batchId);

    if (batch.status === "completed") {
      if (!batch.output_file_id) return requests.map((r) => ({ customId: r.customId, ok: false, error: "no output" }));
      const text = await downloadFileText(batch.output_file_id);
      const parsed = parseOutputJsonl(text);
      const byId = new Map(parsed.map((item) => [item.customId, item]));
      return requests.map(
        (request) =>
          byId.get(request.customId) ?? {
            customId: request.customId,
            ok: false,
            error: "missing in batch output",
          },
      );
    }

    if (batch.status === "failed" || batch.status === "expired" || batch.status === "cancelled") {
      throw new Error(`OpenAI batch ${batchId} ended with status=${batch.status}`);
    }

    if (Date.now() - started > maxWaitMs) {
      throw new Error(`OpenAI batch ${batchId} exceeded maxWaitMs=${maxWaitMs}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
