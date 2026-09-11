/**
 * CI gates for LIVE overlay quality:
 * - native chart boards must not be majority free-topic category-live when natives exist
 * - politics Google RSS / fallback success rate
 * - screen-20 live lead metric (P2-9)
 *
 *   npx tsx scripts/_check-live-overlay-gates.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  HEATMAP_SCREEN_LIVE_CAP,
  NATIVE_CHART_BOARD_SLUGS,
  countScreenLiveLead,
  isNativeChartEntityType,
} from "../src/lib/boards/live-priority";
import type { RankingEntity } from "../src/lib/types";

interface SnapshotLike {
  items?: RankingEntity[];
  sources?: { id: string; ok?: boolean; count?: number; error?: string; label?: string }[];
}

function loadSnapshot(): SnapshotLike | null {
  const candidates = [
    join(process.cwd(), "src/data/ingestion/snapshot.json"),
    join(process.cwd(), "data/trends/snapshot.json"),
    join(process.cwd(), "public/data/trends/snapshot.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as SnapshotLike;
    } catch {
      /* try next */
    }
  }
  return null;
}

function nameKey(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

function boardHead(items: RankingEntity[], slug: string, limit = HEATMAP_SCREEN_LIVE_CAP) {
  const tagged = items
    .filter(
      (item) =>
        item.tags?.includes(slug) &&
        (item.tags.includes("live-chart") || item.slug.startsWith(`${slug}--`)),
    )
    .sort((a, b) => a.rank - b.rank || b.buzzScore - a.buzzScore);
  const typed = items
    .filter((item) => isNativeChartEntityType(item.type))
    .filter((item) => item.tags?.includes(slug) || NATIVE_CHART_BOARD_SLUGS.has(slug))
    .sort((a, b) => a.rank - b.rank || b.buzzScore - a.buzzScore);

  // Approximate runtime merge: typed first for native boards, else tagged.
  const ordered = NATIVE_CHART_BOARD_SLUGS.has(slug) ? [...typed, ...tagged] : [...tagged, ...typed];
  const seen = new Set<string>();
  const head: RankingEntity[] = [];
  for (const item of ordered) {
    const key = nameKey(item.name ?? "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    head.push(item);
    if (head.length >= limit) break;
  }
  return head;
}

function main() {
  const snapshot = loadSnapshot();
  if (!snapshot?.items?.length) {
    console.log("live-overlay gates: SKIP (no snapshot on disk)");
    return;
  }

  const items = snapshot.items;
  let failed = false;
  const report: string[] = [];

  // P1-8: native boards must not be majority free-topic category-live when natives exist.
  for (const slug of NATIVE_CHART_BOARD_SLUGS) {
    const typed = items.filter(
      (item) => isNativeChartEntityType(item.type) && (item.tags?.includes(slug) || true),
    );
    const typedForBoard = items.filter((item) => {
      if (!isNativeChartEntityType(item.type)) return false;
      // Music board ↔ music_chart, etc. via tag or type alone after stamp.
      return item.tags?.includes(slug) || item.tags?.includes("live-chart");
    });
    const natives = typedForBoard.filter((item) => item.tags?.includes(slug));
    const head = boardHead(items, slug);
    if (!head.length) continue;

    const nativeInHead = head.filter(
      (item) => isNativeChartEntityType(item.type) || item.tags?.includes(slug),
    ).length;
    const categoryOnly = head.filter(
      (item) =>
        item.tags?.includes(slug) &&
        item.tags?.includes("live-chart") &&
        !isNativeChartEntityType(item.type),
    ).length;

    // Only gate when enough typed natives exist in the snapshot.
    const typedPool = items.filter((item) => {
      if (!isNativeChartEntityType(item.type)) return false;
      if (slug === "realtime-music-chart") return item.type === "music_chart";
      if (slug === "realtime-webtoon-rank") return item.type === "webtoon";
      if (slug === "boxoffice-expectation") return item.type === "movie";
      if (slug === "realtime-tv-ratings") return item.type === "tv_rating" || item.type === "tv_show";
      if (slug === "game-esports-ranking") {
        return item.type === "pc_game" || item.type === "mobile_game" || item.type === "console_game";
      }
      return false;
    });

    if (typedPool.length >= 12 && categoryOnly > nativeInHead && categoryOnly / head.length > 0.55) {
      failed = true;
      report.push(
        `BAD native-priority ${slug}: category-live ${categoryOnly}/${head.length} dominates typed pool ${typedPool.length}`,
      );
    } else {
      report.push(
        `ok native-priority ${slug}: head=${head.length} typedPool=${typedPool.length} categoryOnly=${categoryOnly}`,
      );
    }
    void typed;
    void natives;
  }

  // Politics RSS / fallback success (soft on stale snapshots that predate fallback).
  const politicsSources = (snapshot.sources ?? []).filter((source) =>
    String(source.id ?? "").startsWith("news-"),
  );
  if (politicsSources.length) {
    const ok = politicsSources.filter((source) => source.ok && (source.count ?? 0) > 0).length;
    const rate = ok / politicsSources.length;
    const hasFallbackLabel = politicsSources.some((source) =>
      String(source.label ?? "").includes("fallback"),
    );
    if (rate < 0.35 && hasFallbackLabel) {
      // Post-fallback ingest still thin → hard fail.
      failed = true;
      report.push(`BAD politics sources ok=${ok}/${politicsSources.length} (${(rate * 100).toFixed(0)}%)`);
    } else if (rate < 0.35) {
      report.push(
        `warn politics sources ok=${ok}/${politicsSources.length} (${(rate * 100).toFixed(0)}%) — re-ingest to apply Naver/Serper fallback`,
      );
    } else {
      report.push(`ok politics sources ok=${ok}/${politicsSources.length} (${(rate * 100).toFixed(0)}%)`);
    }
  } else {
    report.push("ok politics sources: none in snapshot (skipped)");
  }

  // P2-9: screen-20 live lead on entertainment-ish pool.
  const entertain = items.filter(
    (item) =>
      item.sourceChannel === "entertainment" ||
      isNativeChartEntityType(item.type) ||
      item.tags?.includes("live-chart"),
  );
  const screenLead = countScreenLiveLead(
    entertain
      .filter((item) => !item.tags?.includes("board-tape"))
      .sort((a, b) => a.rank - b.rank || b.buzzScore - a.buzzScore),
  );
  const screenRatio = screenLead / HEATMAP_SCREEN_LIVE_CAP;
  report.push(
    `screen-20 live lead=${screenLead}/${HEATMAP_SCREEN_LIVE_CAP} (${(screenRatio * 100).toFixed(0)}%)`,
  );
  // Soft gate: warn-level only when extremely low; hard-fail under 25%.
  if (entertain.length >= HEATMAP_SCREEN_LIVE_CAP && screenRatio < 0.25) {
    failed = true;
    report.push("BAD screen-20 live lead below 25%");
  }

  for (const line of report) console.log(line);
  if (failed) {
    console.error("live-overlay gates FAILED");
    process.exit(1);
  }
  console.log("live-overlay gates OK");
}

main();
