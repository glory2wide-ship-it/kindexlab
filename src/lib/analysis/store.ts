import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TrafficPump } from "@/lib/analysis/chain/pump";
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
  /** Distribution assets stored as a set with the column. */
  pump?: TrafficPump;
}

const FILE_REL = path.join("src", "data", "analysis", "cache.json");
const memory = new Map<string, CachedAnalysis>();
/** mtime of the last file we merged, so a write by another module instance is picked up. */
let loadedMtimeMs = -1;

export function analysisTtlHours(): number {
  const parsed = Number.parseInt(process.env.ANALYSIS_TTL_HOURS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
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

/**
 * Merges the on-disk cache into memory when the file has changed. Next builds
 * route handlers and server components into separate module graphs, so each
 * holds its own Map; without the mtime check a page render and an API call
 * would disagree about what is cached.
 */
async function loadDisk(): Promise<void> {
  const file = path.join(process.cwd(), FILE_REL);
  try {
    const info = await stat(file);
    if (info.mtimeMs === loadedMtimeMs) return;
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as { entries?: CachedAnalysis[] };
    // Replace rather than merge: a writer always persists its whole map, so the
    // file is authoritative and a reset propagates instead of being re-merged.
    memory.clear();
    for (const entry of parsed.entries ?? []) {
      if (entry?.slug) memory.set(entry.slug, entry);
    }
    loadedMtimeMs = info.mtimeMs;
  } catch {
    // No cache file yet; the store simply starts empty.
  }
}

async function writeDisk(): Promise<boolean> {
  // Vercel's filesystem is read-only at runtime; Supabase carries the entry there.
  if (process.env.VERCEL === "1") return false;
  try {
    const file = path.join(process.cwd(), FILE_REL);
    await mkdir(path.dirname(file), { recursive: true });
    const entries = [...memory.values()].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    await writeFile(file, `${JSON.stringify({ entries }, null, 2)}\n`, "utf8");
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
        cache: "no-store",
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
  await loadDisk();
  const local = memory.get(slug);
  if (local) return local;
  const remote = await supabaseGet(slug);
  if (remote) memory.set(slug, remote);
  return remote;
}

export async function writeAnalysis(entry: CachedAnalysis): Promise<{
  file: boolean;
  supabase: boolean;
}> {
  await loadDisk();
  memory.set(entry.slug, entry);
  const [file, supabase] = await Promise.all([writeDisk(), supabaseUpsert(entry)]);
  return { file, supabase };
}

export async function listAnalysis(): Promise<CachedAnalysis[]> {
  await loadDisk();
  return [...memory.values()].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
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
