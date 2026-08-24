import { decodeBody } from "@/lib/ingestion/decode";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const lastHit = new Map<string, number>();

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function throttle(url: string, gapMs = 450): Promise<void> {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + gapMs - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastHit.set(host, Date.now());
}

function headers(extra?: HeadersInit): Headers {
  const result = new Headers({
    Accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    "User-Agent": process.env.INGEST_USER_AGENT || DEFAULT_UA,
  });
  if (extra) {
    new Headers(extra).forEach((value, key) => result.set(key, value));
  }
  return result;
}

async function request(url: string, init?: RequestInit, attempt = 0): Promise<Response> {
  await throttle(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14_000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: headers(init?.headers),
      redirect: "follow",
      cache: "no-store",
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      return request(url, init, attempt + 1);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBuffer(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; contentType: string; buffer: ArrayBuffer }> {
  const response = await request(url, init);
  const buffer = await response.arrayBuffer();
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    buffer,
  };
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const { status, contentType, buffer } = await fetchBuffer(url, init);
  const text = decodeBody(buffer, contentType);
  if (status >= 400) {
    throw new HttpError(`HTTP ${status} for ${url}`, status);
  }
  if (/captcha|access denied|cloudflare/i.test(text.slice(0, 2500)) && text.length < 4000) {
    throw new HttpError(`Blocked or captcha page for ${url}`, status);
  }
  return text;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const text = await fetchText(url, {
    ...init,
    headers: {
      Accept: "application/json,text/plain,*/*",
      ...Object.fromEntries(new Headers(init?.headers).entries()),
    },
  });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(`Invalid JSON from ${url}`);
  }
}

export async function fetchFormJson<T>(url: string, body: Record<string, string>): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: new URLSearchParams(body).toString(),
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}
