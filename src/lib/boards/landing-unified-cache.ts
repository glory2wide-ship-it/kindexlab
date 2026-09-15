import "server-only";

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DESK_TOP_N, LANDING_PER_CHANNEL_TOP } from "@/lib/boards/landing-constants";
import { DEFAULT_TRENDS_REVALIDATE_SEC } from "@/lib/refresh";
import type { RankingEntity } from "@/lib/types";
import type { PostChannel } from "@/lib/posts/types";

/** Bump when landing desk/heatmap contract changes (desk top-4, rank integrity). */
const CACHE_VERSION = 3;
const MAX_AGE_MS = DEFAULT_TRENDS_REVALIDATE_SEC * 1000;
const EXPECTED_TILES = 5 * LANDING_PER_CHANNEL_TOP;

/** Slim shape only — avoids importing composite-desk (circular). */
export type LandingUnifiedCacheMarket = {
  items: RankingEntity[];
  desks: Array<{
    channel: PostChannel;
    label: string;
    href: string;
    eyebrow: string;
    top: RankingEntity[];
  }>;
};

type LandingUnifiedCacheFile = {
  version: number;
  savedAt: string;
  market: LandingUnifiedCacheMarket;
};

function snapshotPath(): string {
  return path.join(process.cwd(), "src", "data", "ingestion", "snapshot.json");
}

function cachePaths(): string[] {
  return [
    path.join(process.cwd(), "src", "data", "ingestion", "landing-unified.json"),
    path.join("/tmp", "kindexlab-landing-unified.json"),
  ];
}

function isFresh(cacheFile: string): boolean {
  try {
    const cacheMtime = statSync(cacheFile).mtimeMs;
    if (Date.now() - cacheMtime > MAX_AGE_MS) return false;
    try {
      const snapMtime = statSync(snapshotPath()).mtimeMs;
      if (cacheMtime < snapMtime) return false;
    } catch {
      // Snapshot missing — still allow a fresh slim cache.
    }
    return true;
  } catch {
    return false;
  }
}

function isCompleteLandingMarket(market: LandingUnifiedCacheMarket): boolean {
  if (market.items.length !== EXPECTED_TILES) return false;
  if (market.desks.length < 5) return false;
  const ranks = market.items.map((item) => item.rank);
  if (new Set(ranks).size !== ranks.length) return false;
  if (!ranks.every((rank, index) => rank === index + 1)) return false;
  return market.desks.every((desk) => desk.top.length === DESK_TOP_N);
}

/**
 * Tiny precomputed landing board (≤20 tiles + 5 desks).
 * Avoids re-deriving the unified market from the multi-MB snapshot on cold isolates.
 */
export function readLandingUnifiedCache(): LandingUnifiedCacheMarket | null {
  for (const file of cachePaths()) {
    if (!isFresh(file)) continue;
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as LandingUnifiedCacheFile;
      if (parsed?.version !== CACHE_VERSION) continue;
      if (!parsed.market?.items?.length || !parsed.market.desks?.length) continue;
      // Reject truncated desk tops / clobbered ranks from older builders.
      if (!isCompleteLandingMarket(parsed.market)) continue;
      return parsed.market;
    } catch {
      continue;
    }
  }
  return null;
}

export function writeLandingUnifiedCache(market: LandingUnifiedCacheMarket): void {
  if (!isCompleteLandingMarket(market)) return;
  const payload: LandingUnifiedCacheFile = {
    version: CACHE_VERSION,
    savedAt: new Date().toISOString(),
    market,
  };
  const body = JSON.stringify(payload);
  for (const file of cachePaths()) {
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, body, "utf8");
    } catch {
      // Vercel/lambda FS may be read-only outside /tmp — ignore.
    }
  }
}
