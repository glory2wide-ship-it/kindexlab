import snapshotFile from "@/data/ingestion/snapshot.json";
import { readFileSync } from "node:fs";
import path from "node:path";
import { composeLiveSnapshot, snapshotToPayload } from "@/lib/ingestion/compose";
import { fetchBroadcastSources } from "@/lib/ingestion/sources/broadcast";
import { fetchBuzzSources } from "@/lib/ingestion/sources/buzz";
import { fetchGameSources } from "@/lib/ingestion/sources/games";
import { fetchMusicSources } from "@/lib/ingestion/sources/music";
import { fetchShortsSources } from "@/lib/ingestion/sources/shorts";
import { fetchPoliticsSources } from "@/lib/ingestion/sources/politics";
import { fetchPoliticsYoutubeSources } from "@/lib/ingestion/sources/youtube-politics";
import { fetchWebtoonSources } from "@/lib/ingestion/sources/webtoon";
import type { IngestReport, IngestSnapshot } from "@/lib/ingestion/types";
import type { RankingsPayload } from "@/lib/types";

let memorySnapshot: IngestSnapshot | undefined;

function readDiskSnapshot(): IngestSnapshot | undefined {
  try {
    const file = path.join(process.cwd(), "src", "data", "ingestion", "snapshot.json");
    const snapshot = JSON.parse(readFileSync(file, "utf8")) as IngestSnapshot;
    if (snapshot?.items?.length) return snapshot;
  } catch {
    // Fall through to the bundled copy when the file is missing at runtime.
  }
  const bundled = snapshotFile as IngestSnapshot;
  if (bundled?.items?.length) return bundled;
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
}

export async function ingestLivePayload(options?: {
  previous?: IngestSnapshot;
}): Promise<IngestReport> {
  const previous = options?.previous ?? readPersistedSnapshot();
  const [music, broadcast, buzz, webtoon, shorts, games, politics, politicsYoutube] = await Promise.all([
    fetchMusicSources(),
    fetchBroadcastSources(),
    fetchBuzzSources(),
    fetchWebtoonSources(),
    fetchShortsSources(),
    fetchGameSources(),
    fetchPoliticsSources(),
    fetchPoliticsYoutubeSources(),
  ]);
  const sources = [...music, ...broadcast, ...buzz, ...webtoon, ...shorts, ...games, ...politics, ...politicsYoutube];
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
