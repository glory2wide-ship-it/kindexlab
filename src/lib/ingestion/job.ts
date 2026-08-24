import snapshotFile from "@/data/ingestion/snapshot.json";
import { readFileSync } from "node:fs";
import path from "node:path";
import { composeLiveSnapshot, snapshotToPayload } from "@/lib/ingestion/compose";
import { fetchBroadcastSources } from "@/lib/ingestion/sources/broadcast";
import { fetchBuzzSources } from "@/lib/ingestion/sources/buzz";
import { fetchMusicSources } from "@/lib/ingestion/sources/music";
import type { IngestReport, IngestSnapshot } from "@/lib/ingestion/types";
import type { RankingsPayload } from "@/lib/types";

export function readPersistedSnapshot(): IngestSnapshot | undefined {
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

export async function ingestLivePayload(options?: {
  previous?: IngestSnapshot;
}): Promise<IngestReport> {
  const previous = options?.previous ?? readPersistedSnapshot();
  const [music, broadcast, buzz] = await Promise.all([
    fetchMusicSources(),
    fetchBroadcastSources(),
    fetchBuzzSources(),
  ]);
  const sources = [...music, ...broadcast, ...buzz];
  const composed = await composeLiveSnapshot(sources, previous);
  const updatedAt = new Date().toISOString();
  let items = composed.items;
  let indices = composed.indices;
  let usedPreviousSnapshot = false;

  if (!items.length && previous?.items.length) {
    items = previous.items;
    indices = previous.indices;
    usedPreviousSnapshot = true;
  }

  const payload: RankingsPayload = snapshotToPayload({
    updatedAt,
    status: items.length ? "open" : "closed",
    indices,
    items,
  });

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
  if (!options?.persist) return report;

  const { persistSnapshot } = await import("@/lib/ingestion/persist");
  const snapshot: IngestSnapshot = {
    updatedAt: report.updatedAt,
    status: report.payload.status,
    sources: report.sourceResults,
    indices: report.payload.indices,
    items: report.payload.items,
    scoreHistory: readPersistedSnapshot()?.scoreHistory ?? {},
  };
  for (const item of report.payload.items) {
    snapshot.scoreHistory[item.slug] = [...(snapshot.scoreHistory[item.slug] ?? []).slice(-6), item.buzzScore];
  }
  const persisted = await persistSnapshot(snapshot);
  return { ...report, persisted: persisted.wrote };
}
