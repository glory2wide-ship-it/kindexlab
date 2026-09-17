/**
 * Public-data (지원금·부동산) failure ledger + soft retry queue for Admin.
 * Soft-fails when the filesystem is read-only (Vercel).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type PublicDataFailKind =
  | "missing_key"
  | "no_match"
  | "http_error"
  | "parse_error";

export type PublicDataFailEntry = {
  id: string;
  channel: string;
  entityName: string;
  kind: PublicDataFailKind;
  reason: string;
  at: string;
  retries: number;
};

type StoreFile = {
  updatedAt: string;
  failures: PublicDataFailEntry[];
  /** Entity keys awaiting another public-data attempt. */
  retryQueue: Array<{
    entityName: string;
    channel: string;
    reason: string;
    enqueuedAt: string;
    attempts: number;
  }>;
};

const STORE_PATH = path.join(process.cwd(), "src/data/ops/public-data-fail-ledger.json");
const MAX_FAILURES = 200;
const MAX_QUEUE = 100;

function readStore(): StoreFile {
  try {
    if (!existsSync(STORE_PATH)) {
      return { updatedAt: new Date().toISOString(), failures: [], retryQueue: [] };
    }
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8")) as StoreFile;
    return {
      updatedAt: raw.updatedAt || new Date().toISOString(),
      failures: Array.isArray(raw.failures) ? raw.failures : [],
      retryQueue: Array.isArray(raw.retryQueue) ? raw.retryQueue : [],
    };
  } catch {
    return { updatedAt: new Date().toISOString(), failures: [], retryQueue: [] };
  }
}

function writeStore(store: StoreFile): void {
  try {
    mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  } catch {
    /* soft */
  }
}

function entryId(channel: string, entityName: string, kind: string): string {
  return `${channel}:${entityName}:${kind}`.slice(0, 160);
}

/** Record a public-API miss and enqueue for retry. */
export function recordPublicDataFailure(input: {
  channel: string;
  entityName: string;
  kind: PublicDataFailKind;
  reason: string;
}): void {
  const name = input.entityName.trim();
  if (!name) return;
  const store = readStore();
  const now = new Date().toISOString();
  const id = entryId(input.channel, name, input.kind);
  const existing = store.failures.find((row) => row.id === id);
  if (existing) {
    existing.reason = input.reason;
    existing.at = now;
    existing.retries += 1;
  } else {
    store.failures.unshift({
      id,
      channel: input.channel,
      entityName: name,
      kind: input.kind,
      reason: input.reason,
      at: now,
      retries: 0,
    });
  }
  store.failures = store.failures.slice(0, MAX_FAILURES);

  const qKey = `${input.channel}:${name}`;
  const queued = store.retryQueue.find(
    (row) => `${row.channel}:${row.entityName}` === qKey,
  );
  if (queued) {
    queued.reason = input.reason;
    queued.enqueuedAt = now;
    queued.attempts += 1;
  } else {
    store.retryQueue.unshift({
      entityName: name,
      channel: input.channel,
      reason: input.reason,
      enqueuedAt: now,
      attempts: 0,
    });
  }
  store.retryQueue = store.retryQueue.slice(0, MAX_QUEUE);
  store.updatedAt = now;
  writeStore(store);
}

export function clearPublicDataRetry(entityName: string, channel: string): void {
  const store = readStore();
  store.retryQueue = store.retryQueue.filter(
    (row) => !(row.entityName === entityName && row.channel === channel),
  );
  store.updatedAt = new Date().toISOString();
  writeStore(store);
}

export function snapshotPublicDataFailLedger(limit = 40): {
  updatedAt: string;
  failures: PublicDataFailEntry[];
  retryQueue: StoreFile["retryQueue"];
} {
  const store = readStore();
  return {
    updatedAt: store.updatedAt,
    failures: store.failures.slice(0, limit),
    retryQueue: store.retryQueue.slice(0, limit),
  };
}
