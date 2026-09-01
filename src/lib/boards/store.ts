import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { AGE_SEGMENTS, applyDemographicWeights, dedupeSegments, isUnusableRankName } from "@/lib/boards/demographics";
import { rankLimitForBoard, segmentLimitForBoard } from "@/lib/boards/limits";
import { getBoard } from "@/lib/boards/registry";
import { boardUsesRegionFilter, ensureFoodRestaurantRanking, ensureHousingApartmentRanking, HOUSING_BOARD_SLUG } from "@/lib/boards/regions";
import type { BoardRankEntry, CachedBoard, DemographicRanking } from "@/lib/boards/types";
import { ensureInfluencerBoardRanking } from "@/lib/politics/fail-safe";
import {
  ensureCultureGrantRanking,
  isCultureGrantBoard,
} from "@/lib/boards/culture-grants";
import {
  ensureLocalPolicyRanking,
  ensurePunditRanking,
  ensureSubsidyRanking,
} from "@/lib/politics/labeled-rank";

function scaleRow(row: BoardRankEntry): BoardRankEntry {
  if (row.score <= 100) return row;
  return { ...row, score: Number((row.score / 10).toFixed(2)) };
}

function scaleList(rows: BoardRankEntry[] | undefined): BoardRankEntry[] {
  return enforceScoreOrder((rows ?? []).map(scaleRow));
}

/** Keeps name order (needed for distinct demographic tabs) while forcing a descending 100-point scale. */
function enforceScoreOrder(rows: BoardRankEntry[]): BoardRankEntry[] {
  let ceiling = Number.POSITIVE_INFINITY;
  return rows.map((row, index) => {
    const score = row.score >= ceiling ? Number((ceiling - 1.25).toFixed(2)) : row.score;
    ceiling = score;
    return { ...row, rank: index + 1, score: Math.max(score, 1) };
  });
}

/** Maps 70s_plus → 70s and folds legacy 1,000-point scores down to 100. */
export function normalizeCachedBoard(entry: CachedBoard): CachedBoard {
  const def = getBoard(entry.slug);
  const ageIn = entry.demographics?.age as Record<string, BoardRankEntry[]> | undefined;
  const age = { ...(entry.demographics?.age ?? {}) } as DemographicRanking["age"];
  if (ageIn && !(ageIn["70s"]?.length) && ageIn["70s_plus"]?.length) {
    age["70s"] = ageIn["70s_plus"];
  }
  const cleaned = scaleList((entry.ranking ?? []).filter((row) => !isUnusableRankName(row.name ?? "")));
  const ranking = padRankingFromSeeds(cleaned, entry.slug);
  const segmentLimit = def ? segmentLimitForBoard(def) : 5;
  const { value: deduped } = dedupeSegments(
    {
      gender: {
        male: scaleList(entry.demographics?.gender?.male),
        female: scaleList(entry.demographics?.gender?.female),
      },
      age: AGE_SEGMENTS.reduce(
        (acc, key) => {
          acc[key] = scaleList(age[key]);
          return acc;
        },
        {} as DemographicRanking["age"],
      ),
      region: entry.demographics?.region,
    },
    ranking,
    segmentLimit,
  );
  const demographics = def ? applyDemographicWeights(def, ranking, deduped) : deduped;
  return {
    ...entry,
    indexValue:
      entry.indexValue > 100 ? Number((entry.indexValue / 10).toFixed(2)) : entry.indexValue,
    ranking,
    demographics,
  };
}

function padRankingFromSeeds(ranking: BoardRankEntry[], slug: string): BoardRankEntry[] {
  const def = getBoard(slug);
  if (!def) return ranking;
  const limit = rankLimitForBoard(def);
  if (slug === "political-influencer-power") {
    return enforceScoreOrder(ensureInfluencerBoardRanking(ranking).slice(0, limit));
  }
  if (slug === "governor-approval-index") {
    return enforceScoreOrder(ensureLocalPolicyRanking(ranking).slice(0, limit));
  }
  if (slug === "government-support-fund" || slug === "government-subsidy-search") {
    return enforceScoreOrder(ensureSubsidyRanking(ranking).slice(0, limit));
  }
  if (isCultureGrantBoard(slug)) {
    return enforceScoreOrder(ensureCultureGrantRanking(ranking).slice(0, limit));
  }
  if (slug === "political-pundit-ranking") {
    return enforceScoreOrder(ensurePunditRanking(ranking).slice(0, limit));
  }
  if (slug === HOUSING_BOARD_SLUG) {
    return enforceScoreOrder(ensureHousingApartmentRanking(ranking, limit));
  }
  if (boardUsesRegionFilter(slug)) {
    return enforceScoreOrder(ensureFoodRestaurantRanking(ranking, def.seeds).slice(0, limit));
  }
  const seen = new Set(ranking.map((row) => row.name));
  const extra: BoardRankEntry[] = [];
  for (const seed of def.seeds) {
    if (seen.has(seed) || isUnusableRankName(seed)) continue;
    extra.push({
      rank: ranking.length + extra.length + 1,
      name: seed,
      score: Number((88 - extra.length * 1.35).toFixed(2)),
      changeRate: Number((((extra.length % 5) - 2) * 1.15).toFixed(2)),
      note: `${def.criteria} 기준 보완 종목`,
    });
    if (ranking.length + extra.length >= limit) break;
  }
  return enforceScoreOrder([...ranking, ...extra].slice(0, limit));
}

function demographicsForStorage(demo: DemographicRanking) {
  return {
    gender: demo.gender,
    age: { ...demo.age, "70s_plus": demo.age["70s"] },
    region: demo.region,
  };
}

const FILE_REL = path.join("src", "data", "boards", "cache.json");
const memory = new Map<string, CachedBoard>();
/** mtime of the last file we merged, so a write by another module instance is seen. */
let loadedMtimeMs = -1;

export function boardTtlHours(): number {
  const parsed = Number.parseInt(process.env.BOARDS_TTL_HOURS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
}

export function isBoardExpired(entry: CachedBoard, now = Date.now()): boolean {
  return new Date(entry.expiresAt).getTime() <= now;
}

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function loadDisk(): Promise<void> {
  const file = path.join(process.cwd(), FILE_REL);
  try {
    const info = await stat(file);
    if (info.mtimeMs === loadedMtimeMs) return;
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as { entries?: CachedBoard[] };
    memory.clear();
    for (const entry of parsed.entries ?? []) {
      if (entry?.slug) memory.set(entry.slug, normalizeCachedBoard(entry));
    }
    loadedMtimeMs = info.mtimeMs;
  } catch {
    // No cache file yet; the store starts empty.
  }
}

async function writeDisk(): Promise<boolean> {
  if (process.env.VERCEL === "1") return false;
  try {
    const file = path.join(process.cwd(), FILE_REL);
    await mkdir(path.dirname(file), { recursive: true });
    const entries = [...memory.values()].sort((a, b) => a.slug.localeCompare(b.slug));
    await writeFile(file, `${JSON.stringify({ entries }, null, 2)}\n`, "utf8");
    loadedMtimeMs = (await stat(file)).mtimeMs;
    return true;
  } catch {
    return false;
  }
}

async function supabaseUpsert(entry: CachedBoard): Promise<boolean> {
  const config = supabaseConfig();
  if (!config) return false;
  try {
    const response = await fetch(`${config.url}/rest/v1/board_cache`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        slug: entry.slug,
        board_id: entry.boardId,
        channel: entry.channel,
        title: entry.title,
        edition_date: entry.editionDate,
        generated_at: entry.generatedAt,
        expires_at: entry.expiresAt,
        source_kind: entry.provenance.kind,
        index_value: entry.indexValue,
        total_ranking: entry.ranking,
        demographic_ranking: demographicsForStorage(entry.demographics),
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

async function supabaseGet(slug: string): Promise<CachedBoard | undefined> {
  const config = supabaseConfig();
  if (!config) return undefined;
  try {
    const response = await fetch(
      `${config.url}/rest/v1/board_cache?slug=eq.${encodeURIComponent(slug)}&select=body&limit=1`,
      {
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
        cache: "no-store",
      },
    );
    if (!response.ok) return undefined;
    const rows = (await response.json()) as { body?: CachedBoard }[];
    return rows[0]?.body;
  } catch {
    return undefined;
  }
}

export async function readBoard(slug: string): Promise<CachedBoard | undefined> {
  await loadDisk();
  const local = memory.get(slug);
  if (local) return local;
  const remote = await supabaseGet(slug);
  if (remote) {
    const normalized = normalizeCachedBoard(remote);
    memory.set(slug, normalized);
    return normalized;
  }
  return undefined;
}

export async function writeBoard(entry: CachedBoard): Promise<{ file: boolean; supabase: boolean }> {
  await loadDisk();
  memory.set(entry.slug, normalizeCachedBoard(entry));
  const [file, supabase] = await Promise.all([writeDisk(), supabaseUpsert(entry)]);
  return { file, supabase };
}

export async function listBoards(): Promise<CachedBoard[]> {
  await loadDisk();
  return [...memory.values()];
}

export async function clearBoards(): Promise<number> {
  await loadDisk();
  const removed = memory.size;
  memory.clear();
  loadedMtimeMs = -1;
  await writeDisk();

  const config = supabaseConfig();
  if (config) {
    try {
      await fetch(`${config.url}/rest/v1/board_cache?slug=neq.`, {
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
