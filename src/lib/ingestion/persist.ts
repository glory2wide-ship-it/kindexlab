import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IngestSnapshot } from "@/lib/ingestion/types";

const snapshotRel = path.join("src", "data", "ingestion", "snapshot.json");

export async function persistSnapshot(
  snapshot: IngestSnapshot,
): Promise<{ wrote: boolean; path: string }> {
  const file = path.join(process.cwd(), snapshotRel);
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    return { wrote: true, path: snapshotRel };
  } catch (error) {
    console.error("[kindexlab:ingest] persist failed", error);
    return { wrote: false, path: snapshotRel };
  }
}
