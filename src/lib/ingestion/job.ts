import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { composeLiveSnapshot, snapshotToPayload } from "@/lib/ingestion/compose";
import { fetchBroadcastSources } from "@/lib/ingestion/sources/broadcast";
import { fetchBookSources } from "@/lib/ingestion/sources/books";
import { fetchBuzzSources } from "@/lib/ingestion/sources/buzz";
import { fetchCategoryLiveSources } from "@/lib/ingestion/sources/category-live";
import { fetchGameSources } from "@/lib/ingestion/sources/games";
import { fetchMusicSources } from "@/lib/ingestion/sources/music";
import { fetchMovieSources } from "@/lib/ingestion/sources/movies";
import { fetchShortsSources } from "@/lib/ingestion/sources/shorts";
import { fetchPoliticsSources } from "@/lib/ingestion/sources/politics";
import { fetchPoliticsYoutubeSources } from "@/lib/ingestion/sources/youtube-politics";
import { fetchTicketSources } from "@/lib/ingestion/sources/tickets";
import { fetchWebtoonSources } from "@/lib/ingestion/sources/webtoon";
import type { IngestReport, IngestSnapshot, SourceResult } from "@/lib/ingestion/types";
import type { RankingsPayload } from "@/lib/types";

/** Cap a single source family so one hung crawl cannot block the job (~47m GHA hang). */
const FAMILY_TIMEOUT_MS = Number(process.env.INGEST_FAMILY_TIMEOUT_MS ?? 4 * 60 * 1000);
/** Hard ceiling for all families; keep under workflow timeout-minutes: 15. */
const OVERALL_TIMEOUT_MS = Number(process.env.INGEST_OVERALL_TIMEOUT_MS ?? 10 * 60 * 1000);

let memorySnapshot: IngestSnapshot | undefined;
/** Avoid re-parsing the multi-MB snapshot.json on every rankings / heatmap call. */
let diskSnapshotCache: IngestSnapshot | undefined;
let diskSnapshotMtimeMs = -1;

function readDiskSnapshot(): IngestSnapshot | undefined {
  try {
    const file = path.join(process.cwd(), "src", "data", "ingestion", "snapshot.json");
    const mtimeMs = statSync(file).mtimeMs;
    if (diskSnapshotCache?.items?.length && mtimeMs === diskSnapshotMtimeMs) {
      return diskSnapshotCache;
    }
    const snapshot = JSON.parse(readFileSync(file, "utf8")) as IngestSnapshot;
    if (snapshot?.items?.length) {
      diskSnapshotCache = snapshot;
      diskSnapshotMtimeMs = mtimeMs;
      return snapshot;
    }
  } catch {
    // Snapshot missing at runtime — rankings fall back to mock/empty.
  }
  return undefined;
}

export function readPersistedSnapshot(): IngestSnapshot | undefined {
  const disk = readDiskSnapshot();
  if (memorySnapshot?.items.length) {
    if (!disk) return memorySnapshot;
    const memAt = Date.parse(memorySnapshot.updatedAt);
    const diskAt = Date.parse(disk.updatedAt);
    if (Number.isFinite(memAt) && (!Number.isFinite(diskAt) || memAt >= diskAt)) {
      return memorySnapshot;
    }
  }
  return disk;
}

function rememberSnapshot(snapshot: IngestSnapshot) {
  memorySnapshot = snapshot;
  diskSnapshotCache = snapshot;
  diskSnapshotMtimeMs = Date.now();
}


function timeoutError(label: string, ms: number): Error {
  return new Error(`${label} timed out after ${Math.round(ms / 1000)}s`);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(timeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function failedFamily(id: string, message: string): SourceResult {
  return {
    id: `family:${id}`,
    label: id,
    ok: false,
    count: 0,
    error: message,
    fetchedAt: new Date().toISOString(),
    items: [],
  };
}

async function runSourceFamily(
  id: string,
  run: () => Promise<SourceResult[]>,
  deadlineMs: number,
): Promise<SourceResult[]> {
  const budget = Math.max(5_000, Math.min(FAMILY_TIMEOUT_MS, deadlineMs - Date.now()));
  const started = Date.now();
  try {
    const results = await withTimeout(run(), budget, `Source family "${id}"`);
    console.info(
      `[kindexlab:ingest] ${id} ok in ${Date.now() - started}ms (${results.length} sources)`,
    );
    return results;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[kindexlab:ingest] ${id} failed: ${message}`);
    return [failedFamily(id, message)];
  }
}

async function gatherSourceFamilies(): Promise<SourceResult[]> {
  const deadlineMs = Date.now() + OVERALL_TIMEOUT_MS;
  const families: Array<[string, () => Promise<SourceResult[]>]> = [
    ["music", fetchMusicSources],
    ["movies", fetchMovieSources],
    ["broadcast", fetchBroadcastSources],
    ["buzz", fetchBuzzSources],
    ["webtoon", fetchWebtoonSources],
    ["shorts", fetchShortsSources],
    ["games", fetchGameSources],
    ["politics", fetchPoliticsSources],
    ["politics-youtube", fetchPoliticsYoutubeSources],
    ["tickets", fetchTicketSources],
    ["books", fetchBookSources],
    ["category-live", fetchCategoryLiveSources],
  ];

  const batches = await withTimeout(
    Promise.all(families.map(([id, run]) => runSourceFamily(id, run, deadlineMs))),
    OVERALL_TIMEOUT_MS,
    "Ingest source gather",
  );
  return batches.flat();
}

export async function ingestLivePayload(options?: {
  previous?: IngestSnapshot;
}): Promise<IngestReport> {
  const previous = options?.previous ?? readPersistedSnapshot();
  let sources: SourceResult[];
  try {
    sources = await gatherSourceFamilies();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[kindexlab:ingest] gather failed: ${message}`);
    sources = [failedFamily("ingest", message)];
  }
  const composed = await composeLiveSnapshot(sources, previous);
  const updatedAt = new Date().toISOString();
  let items = composed.items;
  let indices = composed.indices;
  let scoreHistory = composed.scoreHistory ?? previous?.scoreHistory ?? {};
  let measurementHistory = composed.measurementHistory ?? previous?.measurementHistory ?? {};
  let usedPreviousSnapshot = false;

  const previousCount = previous?.items.length ?? 0;
  const collapsed =
    previousCount > 0 && items.length < Math.max(40, Math.floor(previousCount * 0.5));
  if ((!items.length || collapsed) && previous?.items.length) {
    items = previous.items;
    indices = previous.indices;
    scoreHistory = previous.scoreHistory ?? scoreHistory;
    // Observations are cumulative, so keep the longer of the two rather than
    // dropping back: a collapsed fetch should never shorten the record.
    measurementHistory = previous.measurementHistory ?? measurementHistory;
    usedPreviousSnapshot = true;
  }

  // Economy/culture/travel: always fold published menu-board rankings into the
  // snapshot; optionally refresh a couple of stale boards when Gemini is on.
  try {
    const {
      loadPublishedBoardTape,
      mergeBoardTape,
      refreshBoardTape,
      shouldRefreshBoardsDuringIngest,
      upsertBoardTape,
    } = await import("@/lib/ingestion/board-tape");
    const published = await loadPublishedBoardTape();
    if (published.length) {
      items = mergeBoardTape(items, published);
    } else {
      const prior = (previous?.items ?? []).filter(
        (item) =>
          item.tags?.includes("board-tape") ||
          ((item.sourceChannel === "economy" ||
            item.sourceChannel === "culture" ||
            item.sourceChannel === "travel") &&
            !item.tags?.includes("live-chart")),
      );
      if (prior.length) items = mergeBoardTape(items, prior);
    }
    if (shouldRefreshBoardsDuringIngest()) {
      const { entities, refreshed } = await refreshBoardTape(2);
      if (entities.length) {
        items = upsertBoardTape(items, entities);
        console.info("[kindexlab:ingest] board tape", refreshed.join(", "));
      }
    }
  } catch (error) {
    console.warn(
      "[kindexlab:ingest] board tape skipped",
      error instanceof Error ? error.message : error,
    );
  }

  const snapshot: IngestSnapshot = {
    updatedAt,
    status: items.length ? "open" : "closed",
    sources: sources.map((item) => ({
      id: item.id,
      ok: item.ok,
      count: item.count,
      error: item.error,
    })),
    indices,
    items,
    scoreHistory,
    measurementHistory,
  };
  rememberSnapshot(snapshot);

  const payload: RankingsPayload = snapshotToPayload(snapshot);

  return {
    updatedAt,
    persisted: false,
    usedPreviousSnapshot,
    sources: sources.map((item) => item.id),
    sourceResults: sources.map((item) => ({
      id: item.id,
      ok: item.ok,
      count: item.count,
      error: item.error,
    })),
    itemCount: items.length,
    payload,
  };
}

export async function runIngestJob(options?: { persist?: boolean }): Promise<IngestReport> {
  const report = await ingestLivePayload();
  if (!options?.persist || !memorySnapshot) return report;

  const { persistSnapshot } = await import("@/lib/ingestion/persist");
  const persisted = await persistSnapshot(memorySnapshot);
  return { ...report, persisted: persisted.wrote };
}
