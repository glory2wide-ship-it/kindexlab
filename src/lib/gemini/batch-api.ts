/**
 * Gemini Batch API client (−50% vs sync generateContent).
 *
 * Used for overnight / cron briefing + premium runs when GEMINI_USE_BATCH=1.
 * @see https://ai.google.dev/gemini-api/docs/batch-api
 */

import type { ChatOptions } from "@/lib/analysis/chain/llm";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";

function defaultModel(): string {
  return process.env.GEMINI_MODEL || process.env.GEMINI_DRAFT_MODEL || "gemini-3.6-flash";
}

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
  };
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is required for Gemini Batch API");
  return key;
}

function buildGenerateContentRequest(options: BatchChatRequest["options"]): Record<string, unknown> {
  const userText = options.jsonSchema
    ? `${options.user}\n\n[출력] 지정 JSON 스키마 키만 포함한 완전 JSON 객체 하나만 반환하세요. 코드블록 금지.`
    : options.user;

  return {
    systemInstruction: { parts: [{ text: options.system }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.4,
      maxOutputTokens: options.maxTokens ?? 8_192,
      responseMimeType: "application/json",
    },
  };
}

/** Builds JSONL lines for Gemini Batch file input (key + GenerateContentRequest). */
export function buildGenerateContentJsonl(requests: BatchChatRequest[]): string {
  return requests
    .map((request) =>
      JSON.stringify({
        key: request.customId,
        request: buildGenerateContentRequest(request.options),
      }),
    )
    .join("\n");
}

async function uploadBatchFile(jsonl: string): Promise<string> {
  const bytes = new TextEncoder().encode(jsonl);
  const start = await fetch(`${GEMINI_API.replace("/v1beta", "")}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey(),
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": "application/jsonl",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "kindexlab-batch" } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error(`Gemini batch file start failed: ${start.status} ${await start.text()}`);
  }

  const finalize = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  if (!finalize.ok) {
    throw new Error(`Gemini batch file upload failed: ${finalize.status} ${await finalize.text()}`);
  }
  const json = (await finalize.json()) as { file?: { name?: string }; name?: string };
  const name = json.file?.name ?? json.name;
  if (!name) throw new Error("Gemini batch file upload returned no name");
  return name;
}

async function createBatch(fileName: string, model: string): Promise<string> {
  const response = await fetch(
    `${GEMINI_API}/models/${encodeURIComponent(model)}:batchGenerateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey(),
      },
      body: JSON.stringify({
        batch: {
          display_name: "kindexlab-content",
          input_config: { file_name: fileName },
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini batch create failed: ${response.status} ${await response.text()}`);
  }
  const json = (await response.json()) as { name?: string };
  if (!json.name) throw new Error("Gemini batch create returned no name");
  return json.name;
}

type GeminiBatchStatus = {
  name?: string;
  done?: boolean;
  error?: { message?: string };
  metadata?: { state?: string };
  response?: {
    responsesFile?: string;
    inlinedResponses?: {
      inlinedResponses?: Array<{
        metadata?: { key?: string };
        response?: {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          usageMetadata?: {
            totalTokenCount?: number;
            promptTokenCount?: number;
            candidatesTokenCount?: number;
          };
        };
        error?: { message?: string };
      }>;
    };
  };
};

async function getBatch(batchName: string): Promise<GeminiBatchStatus> {
  const response = await fetch(`${GEMINI_API}/${batchName}`, {
    headers: { "x-goog-api-key": apiKey() },
  });
  if (!response.ok) {
    throw new Error(`Gemini batch poll failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as GeminiBatchStatus;
}

async function downloadResponsesFile(fileName: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/download/v1beta/${fileName}:download?alt=media`,
    { headers: { "x-goog-api-key": apiKey() } },
  );
  if (!response.ok) {
    throw new Error(`Gemini batch download failed: ${response.status}`);
  }
  return response.text();
}

function textFromCandidate(parts?: { text?: string }[]): string {
  return parts?.map((part) => part.text ?? "").join("") ?? "";
}

function parseOutputJsonl(text: string): BatchChatResult[] {
  const results: BatchChatResult[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as {
        key?: string;
        response?: {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          usageMetadata?: {
            totalTokenCount?: number;
            promptTokenCount?: number;
            candidatesTokenCount?: number;
          };
        };
        error?: { message?: string };
      };
      const content = textFromCandidate(row.response?.candidates?.[0]?.content?.parts);
      if (content.trim()) {
        results.push({
          customId: row.key ?? "",
          ok: true,
          content,
          usage: {
            total_tokens: row.response?.usageMetadata?.totalTokenCount,
            prompt_tokens: row.response?.usageMetadata?.promptTokenCount,
            completion_tokens: row.response?.usageMetadata?.candidatesTokenCount,
          },
        });
      } else {
        results.push({
          customId: row.key ?? "",
          ok: false,
          error: row.error?.message ?? "batch item empty",
        });
      }
    } catch {
      results.push({ customId: "", ok: false, error: "invalid batch output line" });
    }
  }
  return results;
}

function parseInlineResponses(
  status: GeminiBatchStatus,
  requests: BatchChatRequest[],
): BatchChatResult[] {
  const rows = status.response?.inlinedResponses?.inlinedResponses ?? [];
  const byKey = new Map<string, BatchChatResult>();
  const ordered: BatchChatResult[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const content = textFromCandidate(row.response?.candidates?.[0]?.content?.parts);
    const customId = row.metadata?.key ?? requests[index]?.customId ?? `idx-${index}`;
    const result: BatchChatResult = content.trim()
      ? {
          customId,
          ok: true,
          content,
          usage: {
            total_tokens: row.response?.usageMetadata?.totalTokenCount,
            prompt_tokens: row.response?.usageMetadata?.promptTokenCount,
            completion_tokens: row.response?.usageMetadata?.candidatesTokenCount,
          },
        }
      : {
          customId,
          ok: false,
          error: row.error?.message ?? "batch item empty",
        };
    byKey.set(customId, result);
    ordered.push(result);
  }

  return requests.map((request, index) => {
    return (
      byKey.get(request.customId) ??
      ordered[index] ?? {
        customId: request.customId,
        ok: false,
        error: "missing in batch output",
      }
    );
  });
}

/**
 * Submits generateContent requests as one Gemini Batch job and waits until done.
 */
export async function runGenerateContentBatch(
  requests: BatchChatRequest[],
  options?: {
    pollIntervalMs?: number;
    maxWaitMs?: number;
    onStatus?: (status: string, batchId: string) => void;
  },
): Promise<BatchChatResult[]> {
  if (!requests.length) return [];

  const pollIntervalMs = options?.pollIntervalMs ?? 15_000;
  const maxWaitMs =
    options?.maxWaitMs ?? Number(process.env.GEMINI_BATCH_MAX_WAIT_MS ?? 5 * 60 * 60 * 1000);

  // One model per job; prefer the first request's model, else draft default.
  const model = requests[0]?.options.model ?? defaultModel();
  const jsonl = buildGenerateContentJsonl(requests);
  const fileName = await uploadBatchFile(jsonl);
  const batchName = await createBatch(fileName, model);
  options?.onStatus?.("JOB_STATE_PENDING", batchName);

  const started = Date.now();
  for (;;) {
    const batch = await getBatch(batchName);
    const state = batch.metadata?.state ?? (batch.done ? "JOB_STATE_SUCCEEDED" : "JOB_STATE_RUNNING");
    options?.onStatus?.(state, batchName);

    if (state === "JOB_STATE_SUCCEEDED" || (batch.done && !batch.error)) {
      if (batch.response?.responsesFile) {
        const text = await downloadResponsesFile(batch.response.responsesFile);
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
      if (batch.response?.inlinedResponses) {
        return parseInlineResponses(batch, requests);
      }
      return requests.map((r) => ({ customId: r.customId, ok: false, error: "no output" }));
    }

    if (
      state === "JOB_STATE_FAILED" ||
      state === "JOB_STATE_EXPIRED" ||
      state === "JOB_STATE_CANCELLED" ||
      batch.error
    ) {
      throw new Error(
        `Gemini batch ${batchName} ended with state=${state}${
          batch.error?.message ? `: ${batch.error.message}` : ""
        }`,
      );
    }

    if (Date.now() - started > maxWaitMs) {
      throw new Error(`Gemini batch ${batchName} exceeded maxWaitMs=${maxWaitMs}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
