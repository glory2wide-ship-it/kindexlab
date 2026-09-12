import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TrafficPump } from "@/lib/analysis/chain/pump";
import { isPublicEditorialContent } from "@/lib/content/public-since";
import type { TodayAnalysisArticle } from "@/lib/editorial/today-analysis";

export type AnalysisSourceKind = "chain" | "template";

export interface AnalysisProvenance {
  /** "chain" when the news-grounded LLM steps produced the body. */
  kind: AnalysisSourceKind;
  newsDocs: number;
  publishers: string[];
  facts: string[];
  model?: string;
  /** Milliseconds the whole pipeline took to build this entry. */
  buildMs: number;
}

export interface CachedAnalysis {
  slug: string;
  keyword: string;
  editionDate: string;
  generatedAt: string;
  expiresAt: string;
  article: TodayAnalysisArticle;
  provenance: AnalysisProvenance;
  /**
   * Last full (non-incremental) rewrite. Incremental refreshes must not update
   * this — the 7-day full-rewrite clock depends on it.
   */
  lastFullRewriteAt?: string;
  /** Distribution assets stored as a set with the column. */
  pump?: TrafficPump;
}

const FILE_REL = path.join("src", "data", "analysis", "cache.json");
const ENTRIES_REL = path.join("src", "data", "analysis", "entries");
const memory = new Map<string, CachedAnalysis>();
/** mtime of the last file we merged, so a write by another module instance is picked up. */
let loadedMtimeMs = -1;

export function analysisShardFileName(slug: string): string {
  return `${createHash("sha1").update(slug).digest("hex").slice(0, 20)}.json`;
}

function shardPath(slug: string): string {
  return path.join(process.cwd(), ENTRIES_REL, analysisShardFileName(slug));
}

async function readShard(slug: string): Promise<CachedAnalysis | undefined> {
  try {
    const parsed = JSON.parse(await readFile(shardPath(slug), "utf8")) as CachedAnalysis;
    return parsed?.slug ? slimCachedEntry(parsed) : undefined;
  } catch {
    return undefined;
  }
}

async function writeShard(entry: CachedAnalysis): Promise<void> {
  if (process.env.VERCEL === "1") return;
  try {
    const dir = path.join(process.cwd(), ENTRIES_REL);
    await mkdir(dir, { recursive: true });
    await writeFile(shardPath(entry.slug), `${JSON.stringify(slimCachedEntry(entry))}\n`);
  } catch {
    /* read-only or missing dir */
  }
}

async function removeShard(slug: string): Promise<void> {
  try {
    await unlink(shardPath(slug));
  } catch {
    /* already gone */
  }
}

export function analysisTtlHours(): number {
  const parsed = Number.parseInt(process.env.ANALYSIS_TTL_HOURS ?? "", 10);
  // Default 48h (2 days): overnight cycle + on-demand freshness share this TTL.
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 48;
}

export function isExpired(entry: CachedAnalysis, now = Date.now()): boolean {
  return new Date(entry.expiresAt).getTime() <= now;
}

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function slimCachedArticle(article: TodayAnalysisArticle): TodayAnalysisArticle {
  const { bodyMarkdown: _md, jsonLd: _ld, ...rest } = article;
  return rest;
}

function slimCachedEntry(entry: CachedAnalysis): CachedAnalysis {
  const { pump: _pump, ...rest } = entry;
  return {
    ...rest,
    article: slimCachedArticle(entry.article),
  };
}

let loadPromise: Promise<void> | null = null;

/**
 * Merges the on-disk cache into memory when the file has changed. Next builds
 * route handlers and server components into separate module graphs, so each
 * holds its own Map; without the mtime check a page render and an API call
 * would disagree about what is cached.
 */
async function loadDisk(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const file = path.join(process.cwd(), FILE_REL);
    try {
      const info = await stat(file);
      if (info.mtimeMs === loadedMtimeMs) return;
      const raw = await readFile(file, "utf8");
      const parsed = JSON.parse(raw) as { entries?: CachedAnalysis[] };
      memory.clear();
      for (const entry of parsed.entries ?? []) {
        if (entry?.slug) memory.set(entry.slug, slimCachedEntry(entry));
      }
      loadedMtimeMs = info.mtimeMs;
    } catch {
      // No cache file yet; the store simply starts empty.
    }
  })().finally(() => {
    loadPromise = null;
  });
  return loadPromise;
}

async function writeDisk(): Promise<boolean> {
  // Vercel's filesystem is read-only at runtime; Supabase carries the entry there.
  if (process.env.VERCEL === "1") return false;
  try {
    const file = path.join(process.cwd(), FILE_REL);
    await mkdir(path.dirname(file), { recursive: true });
    const entries = [...memory.values()]
      .map(slimCachedEntry)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    await writeFile(file, `${JSON.stringify({ entries })}\n`, "utf8");
    // Adopt our own write so the next read does not re-merge what we just wrote.
    loadedMtimeMs = (await stat(file)).mtimeMs;
    return true;
  } catch {
    return false;
  }
}

async function supabaseUpsert(entry: CachedAnalysis): Promise<boolean> {
  const config = supabaseConfig();
  if (!config) return false;
  try {
    const response = await fetch(`${config.url}/rest/v1/analysis_cache`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        slug: entry.slug,
        keyword: entry.keyword,
        edition_date: entry.editionDate,
        generated_at: entry.generatedAt,
        expires_at: entry.expiresAt,
        source_kind: entry.provenance.kind,
        shorts_script: entry.pump?.shortsScript ?? null,
        pinned_comment: entry.pump?.pinnedComment ?? null,
        body: entry,
      }),
    });
    return response.ok || response.status === 409;
  } catch {
    return false;
  }
}

async function supabaseGet(slug: string): Promise<CachedAnalysis | undefined> {
  const config = supabaseConfig();
  if (!config) return undefined;
  try {
    const response = await fetch(
      `${config.url}/rest/v1/analysis_cache?slug=eq.${encodeURIComponent(slug)}&select=body&limit=1`,
      {
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
        next: { revalidate: 300 },
      },
    );
    if (!response.ok) return undefined;
    const rows = (await response.json()) as { body?: CachedAnalysis }[];
    return rows[0]?.body;
  } catch {
    return undefined;
  }
}

export async function readAnalysis(slug: string): Promise<CachedAnalysis | undefined> {
  // Prefer the on-disk shard when it is newer than this process's memory.
  // Overnight / CLI regenerations write shards from another Node process; without
  // this check a long-lived Next server keeps serving the pre-regen column.
  const shard = await readShard(slug);
  const cached = memory.get(slug);
  const freshest =
    shard && (!cached || (shard.generatedAt || "") >= (cached.generatedAt || ""))
      ? shard
      : cached;
  if (shard && freshest === shard) {
    memory.set(slug, shard);
  }

  if (freshest) {
    return isPublicEditorialContent({
      editionDate: freshest.editionDate || freshest.article?.editionDate,
      generatedAt: freshest.generatedAt,
    })
      ? freshest
      : undefined;
  }

  const remote = await supabaseGet(slug);
  if (remote) {
    if (
      !isPublicEditorialContent({
        editionDate: remote.editionDate || remote.article?.editionDate,
        generatedAt: remote.generatedAt,
      })
    ) {
      return undefined;
    }
    const slim = slimCachedEntry(remote);
    memory.set(slug, slim);
    return slim;
  }

  try {
    await stat(path.join(process.cwd(), ENTRIES_REL, ".stamp"));
    return undefined;
  } catch {
    /* shards not built — fall through to the monolith */
  }

  await loadDisk();
  const local = memory.get(slug);
  if (!local) return undefined;
  return isPublicEditorialContent({
    editionDate: local.editionDate || local.article?.editionDate,
    generatedAt: local.generatedAt,
  })
    ? local
    : undefined;
}

export async function writeAnalysis(entry: CachedAnalysis): Promise<{
  file: boolean;
  supabase: boolean;
}> {
  await loadDisk();
  const slim = slimCachedEntry(entry);
  memory.set(entry.slug, slim);
  const [file, supabase] = await Promise.all([writeDisk(), supabaseUpsert(entry), writeShard(slim)]);
  return { file, supabase };
}

export async function listAnalysis(): Promise<CachedAnalysis[]> {
  await loadDisk();
  return [...memory.values()]
    .filter((entry) =>
      isPublicEditorialContent({
        editionDate: entry.editionDate || entry.article?.editionDate,
        generatedAt: entry.generatedAt,
      }),
    )
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

/**
 * Drops every cached column so the next request regenerates under current
 * pipeline rules. Used by the cron route's reset flag after a prompt change.
 */
export async function clearAnalysis(): Promise<number> {
  await loadDisk();
  const removed = memory.size;
  memory.clear();
  loadedMtimeMs = -1;
  await writeDisk();

  const config = supabaseConfig();
  if (config) {
    try {
      await fetch(`${config.url}/rest/v1/analysis_cache?slug=neq.`, {
        method: "DELETE",
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
          Prefer: "return=minimal",
        },
      });
    } catch {
      // Local clear already happened; a stale remote row expires on its own.
    }
  }

  return removed;
}

/** Drops one cached column (disk + Supabase) so the next generate is cold. */
export async function deleteAnalysis(slug: string): Promise<boolean> {
  await loadDisk();
  const hadLocal = memory.delete(slug);
  if (hadLocal) await writeDisk();
  await removeShard(slug);

  const config = supabaseConfig();
  if (config) {
    try {
      const response = await fetch(
        `${config.url}/rest/v1/analysis_cache?slug=eq.${encodeURIComponent(slug)}`,
        {
          method: "DELETE",
          headers: {
            apikey: config.key,
            Authorization: `Bearer ${config.key}`,
            Prefer: "return=minimal",
          },
        },
      );
      return hadLocal || response.ok;
    } catch {
      return hadLocal;
    }
  }

  return hadLocal;
}
