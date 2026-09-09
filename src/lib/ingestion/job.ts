import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { composeLiveSnapshot, snapshotToPayload } from "@/lib/ingestion/compose";
import { fetchBroadcastSources } from "@/lib/ingestion/sources/broadcast";
import { fetchBuzzSources } from "@/lib/ingestion/sources/buzz";
import { fetchGameSources } from "@/lib/ingestion/sources/games";
import { fetchMusicSources } from "@/lib/ingestion/sources/music";
import { fetchMovieSources } from "@/lib/ingestion/sources/movies";
import { fetchShortsSources } from "@/lib/ingestion/sources/shorts";
import { fetchPoliticsSources } from "@/lib/ingestion/sources/politics";
import { fetchPoliticsYoutubeSources } from "@/lib/ingestion/sources/youtube-politics";
import { fetchTicketSources } from "@/lib/ingestion/sources/tickets";
import { fetchWebtoonSources } from "@/lib/ingestion/sources/webtoon";
import type { IngestReport, IngestSnapshot } from "@/lib/ingestion/types";
import type { RankingsPayload } from "@/lib/types";

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

export async function ingestLivePayload(options?: {
  previous?: IngestSnapshot;
}): Promise<IngestReport> {
  const previous = options?.previous ?? readPersistedSnapshot();
  const [music, movies, broadcast, buzz, webtoon, shorts, games, politics, politicsYoutube, tickets] =
    await Promise.all([
      fetchMusicSources(),
      fetchMovieSources(),
      fetchBroadcastSources(),
      fetchBuzzSources(),
      fetchWebtoonSources(),
      fetchShortsSources(),
      fetchGameSources(),
      fetchPoliticsSources(),
      fetchPoliticsYoutubeSources(),
      fetchTicketSources(),
    ]);
  const sources = [
    ...music,
    ...movies,
    ...broadcast,
    ...buzz,
    ...webtoon,
    ...shorts,
    ...games,
    ...politics,
    ...politicsYoutube,
    ...tickets,
  ];
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

  // Economy/culture/travel desks have no crawler tape — fold LLM board rankings
  // into the snapshot on an hourly window so heatmaps move with the same commit.
  try {
    const { mergeBoardTape, refreshBoardTape, shouldRefreshBoardsDuringIngest } = await import(
      "@/lib/ingestion/board-tape"
    );
    if (shouldRefreshBoardsDuringIngest()) {
      const { entities, refreshed } = await refreshBoardTape(2);
      if (entities.length) {
        items = mergeBoardTape(items, entities);
        console.info("[kindexlab:ingest] board tape", refreshed.join(", "));
      }
    } else {
      const prior = (previous?.items ?? []).filter(
        (item) => item.type === "economy_board" || item.type === "culture_board",
      );
      if (prior.length) items = mergeBoardTape(items, prior);
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
