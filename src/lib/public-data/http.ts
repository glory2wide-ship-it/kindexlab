import { fetchText } from "@/lib/ingestion/http";
import { dataGoKrServiceKey } from "@/lib/public-data/key";

/** Build query string; serviceKey is URL-encoded once (Decoding key). */
export function withServiceKey(
  baseUrl: string,
  params: Record<string, string | number | undefined>,
): string | undefined {
  const key = dataGoKrServiceKey();
  if (!key) return undefined;
  const url = new URL(baseUrl);
  url.searchParams.set("serviceKey", key);
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(name, String(value));
  }
  return url.toString();
}

export async function fetchPublicText(
  baseUrl: string,
  params: Record<string, string | number | undefined>,
  init?: RequestInit,
): Promise<string | undefined> {
  const url = withServiceKey(baseUrl, params);
  if (!url) return undefined;
  try {
    return await fetchText(url, {
      ...init,
      headers: {
        Accept: "application/json,application/xml,text/xml,*/*",
        ...Object.fromEntries(new Headers(init?.headers).entries()),
      },
    });
  } catch {
    return undefined;
  }
}

export async function fetchPublicJson<T>(
  baseUrl: string,
  params: Record<string, string | number | undefined>,
): Promise<T | undefined> {
  const text = await fetchPublicText(baseUrl, { ...params, returnType: "JSON", _type: "json" });
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/** Minimal XML tag extractor — enough for RTMS / 복지로 list payloads. */
export function xmlTag(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
  const hit = block.match(re)?.[1]?.trim();
  return hit || undefined;
}

export function xmlItems(xml: string, itemTag = "item"): string[] {
  const re = new RegExp(`<${itemTag}>([\\s\\S]*?)<\\/${itemTag}>`, "gi");
  return [...xml.matchAll(re)].map((m) => m[1] ?? "").filter(Boolean);
}

export function xmlServList(xml: string): string[] {
  return xmlItems(xml, "servList");
}

export function cleanPublicText(raw?: string): string | undefined {
  if (!raw) return undefined;
  const text = raw
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

export function clip(text: string | undefined, max = 160): string | undefined {
  if (!text) return undefined;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
