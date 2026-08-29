import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchText } from "@/lib/ingestion/http";

/**
 * Resolves Google News RSS links to the publisher's own article URL.
 *
 * A feed link like `news.google.com/rss/articles/CBMi...` is an opaque handle,
 * not a redirect: requesting it returns a JavaScript shim whose canonical tag
 * still points back at Google, so following HTTP redirects resolves nothing.
 * The real destination comes from Google's own signed RPC, which needs a
 * per-article signature that is only published in that article page's HTML.
 *
 * That makes each resolution two requests, so results are cached on disk —
 * boards covering the same story would otherwise re-resolve the same handles on
 * every rebuild.
 */

const RPC_ENDPOINT = "https://news.google.com/_/DotsSplashUi/data/batchexecute";
const RPC_ID = "Fbv4je";
const FILE_REL = path.join("src", "data", "news", "url-cache.json");

/** Resolved URL, or null when the handle could not be resolved. */
const memory = new Map<string, string | null>();
let loaded = false;
let dirty = false;

export interface UnwrapStats {
  attempted: number;
  resolved: number;
  cached: number;
  failed: number;
}

export function isGoogleNewsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.hostname.endsWith("news.google.com") && url.pathname.includes("/articles/");
  } catch {
    return false;
  }
}

function articleId(raw: string): string | null {
  try {
    const id = new URL(raw).pathname.split("/articles/")[1];
    return id ? id.split("/")[0] : null;
  } catch {
    return null;
  }
}

async function loadCache(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await readFile(path.join(process.cwd(), FILE_REL), "utf8");
    const parsed = JSON.parse(raw) as { entries?: Record<string, string | null> };
    for (const [key, value] of Object.entries(parsed.entries ?? {})) memory.set(key, value);
  } catch {
    // No cache yet; the resolver simply starts cold.
  }
}

export async function flushUnwrapCache(): Promise<boolean> {
  if (!dirty || process.env.VERCEL === "1") return false;
  try {
    const file = path.join(process.cwd(), FILE_REL);
    await mkdir(path.dirname(file), { recursive: true });
    const entries = Object.fromEntries([...memory.entries()]);
    await writeFile(file, `${JSON.stringify({ entries }, null, 2)}\n`, "utf8");
    dirty = false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Pulls the article-scoped signature out of the interstitial page. Google puts
 * it in the trailing bytes of a ~590KB document, so there is nothing to gain
 * from streaming and stopping early.
 */
async function readSignature(url: string): Promise<{ ts: number; sig: string } | null> {
  const html = await fetchText(url, { headers: { Accept: "text/html,application/xhtml+xml" } });
  const sig = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = html.match(/data-n-a-ts="(\d+)"/)?.[1];
  if (!sig || !ts) return null;
  return { ts: Number(ts), sig };
}

function rpcPayload(id: string, ts: number, sig: string): string {
  const inner = JSON.stringify([
    "garturlreq",
    [
      ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
      "X",
      "X",
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0,
    ],
    id,
    ts,
    sig,
  ]);
  return JSON.stringify([[[RPC_ID, inner, null, "generic"]]]);
}

/**
 * Google prefixes the response with an anti-JSON-hijacking guard and wraps the
 * payload in two layers of encoded JSON, so the URL has to be dug out rather
 * than read off a field.
 */
function parseRpcResponse(body: string): string | null {
  const line = body.split("\n").find((row) => row.includes("garturlres"));
  if (!line) return null;
  try {
    const outer = JSON.parse(line) as unknown[][];
    const payload = outer[0]?.[2];
    if (typeof payload !== "string") return null;
    const parsed = JSON.parse(payload) as unknown[];
    const url = parsed[1];
    return typeof url === "string" && /^https?:\/\//.test(url) ? url : null;
  } catch {
    return null;
  }
}

async function resolveOne(url: string): Promise<string | null> {
  const id = articleId(url);
  if (!id) return null;

  const signature = await readSignature(url);
  if (!signature) return null;

  const body = await fetchText(RPC_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ "f.req": rpcPayload(id, signature.ts, signature.sig) }).toString(),
  });

  return parseRpcResponse(body);
}

/**
 * Returns the publisher URL for a Google News handle, or null when it cannot be
 * resolved. Non-Google URLs are returned unchanged, so this is safe to call on
 * every retrieved document regardless of provider.
 */
export async function unwrapNewsUrl(url: string): Promise<string | null> {
  if (!isGoogleNewsUrl(url)) return url;

  await loadCache();
  const id = articleId(url);
  if (!id) return null;
  if (memory.has(id)) return memory.get(id) ?? null;

  let resolved: string | null = null;
  try {
    resolved = await resolveOne(url);
  } catch {
    resolved = null;
  }

  // Failures are cached too: an unresolvable handle stays unresolvable, and
  // re-attempting it on every rebuild would cost two requests for nothing.
  memory.set(id, resolved);
  dirty = true;
  return resolved;
}

/**
 * Resolves a list of URLs in order. Google throttles per host in the shared
 * fetch layer anyway, so requests are issued sequentially rather than pretending
 * concurrency would help.
 */
export async function unwrapNewsUrls(urls: string[]): Promise<{
  resolved: Map<string, string>;
  stats: UnwrapStats;
}> {
  await loadCache();
  const resolved = new Map<string, string>();
  const stats: UnwrapStats = { attempted: 0, resolved: 0, cached: 0, failed: 0 };

  for (const url of urls) {
    if (!isGoogleNewsUrl(url)) {
      resolved.set(url, url);
      stats.resolved += 1;
      continue;
    }
    stats.attempted += 1;
    const id = articleId(url);
    const hit = id ? memory.has(id) : false;
    const target = await unwrapNewsUrl(url);
    if (target) {
      resolved.set(url, target);
      stats.resolved += 1;
      if (hit) stats.cached += 1;
    } else {
      stats.failed += 1;
    }
  }

  await flushUnwrapCache();
  return { resolved, stats };
}

/** Display name for a source, derived from the resolved publisher domain. */
export function publisherFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
