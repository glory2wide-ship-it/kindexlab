import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { getTrendsSource } from "@/lib/providers/trends";
import type { IngestSnapshot } from "@/lib/ingestion/types";

/** Sources that may fail without keys / behind bot walls without failing the board. */
export const OPTIONAL_INGEST_SOURCES = new Set([
  "kopis-boxoffice",
  "ticketlink-rank",
  // Apple KR topsongs RSS is often empty; apple-music covers the same chart.
  "itunes",
  // KOBIS OpenAPI sample keys get revoked; HTML fallback + naver/maxmovie cover movies.
  "kobis-daily",
  // MaxMovie news page flakes; naver-movie + kobis HTML cover the movie board.
  "maxmovie",
  // Flaky third-party scrapes — covered by Melon/Genie/Bugs, Steam HTML, etc.
  "youtube-music",
  "google-trends",
  "youtube-trending",
  "steam-most-played",
  "steam-charts",
  "yes24-ticket-rank",
  // Books board is sparse; family timeout + prior snapshot cover gaps.
  "yes24-bestseller",
  // Nielsen Korea HTML and Interpark ranking pages time out often under load.
  "nielsen-terrestrial",
  "nielsen-cable",
  "interpark-musical",
  "interpark-drama",
  "interpark-classic",
  "interpark-exhibit",
  // Synthetic rows when a source family hits its wall-clock budget.
  // politics news often contends with heatmap Serper/Naver during overnight Batch;
  // youtube-politics-seeds still covers the politics surface when this times out.
  "family:politics",
  "family:category-live",
  "family:politics-youtube",
  "family:books",
  "family:tickets",
  "family:games",
]);

/**
 * Google News RSS feeds (including `news-ent`) flake under concurrent heatmap
 * Batch / outbound pressure. Treat all news-* as optional so a healthy
 * Melon/Naver chart snapshot is not rejected for transient Google 504s.
 * Soft critical handling below still warns when news-ent is down.
 */
export function isOptionalIngestSource(id: string): boolean {
  if (OPTIONAL_INGEST_SOURCES.has(id)) return true;
  if (id.startsWith("news-")) return true;
  if (id.startsWith("nielsen-")) return true;
  if (id.startsWith("interpark-")) return true;
  return false;
}

export type TrendsHealthIssue = {
  code:
    | "mock_source"
    | "missing_snapshot"
    | "empty_snapshot"
    | "stale_snapshot"
    | "too_many_failures"
    | "critical_source_failed"
    | "used_previous_snapshot";
  level: "error" | "warn";
  message: string;
};

export type TrendsHealthReport = {
  ok: boolean;
  source: "live" | "mock";
  updatedAt?: string;
  ageMs?: number;
  itemCount: number;
  sourceCount: number;
  failedCount: number;
  requiredFailedCount: number;
  failedSources: { id: string; error?: string; optional: boolean }[];
  issues: TrendsHealthIssue[];
};

export type TrendsHealthOptions = {
  /** Max snapshot age before it is considered stale. Default 6h. */
  maxAgeMs?: number;
  /** Minimum ranking rows expected in a healthy snapshot. Default 400. */
  minItems?: number;
  /** Max non-optional source failures. Default 8. */
  maxRequiredFailures?: number;
  /** Treat TRENDS_DATA_SOURCE=mock as an error. */
  rejectMock?: boolean;
  /** Fail when the last ingest reused the previous snapshot. */
  rejectUsedPrevious?: boolean;
  usedPreviousSnapshot?: boolean;
  snapshot?: IngestSnapshot | null;
};

const CRITICAL_SOURCE_IDS = [
  "melon",
  "naver-webtoon-weekly",
  "naver-movie",
  "news-ent",
] as const;

function readSnapshotFromDisk(): IngestSnapshot | null {
  try {
    const file = path.join(process.cwd(), "src", "data", "ingestion", "snapshot.json");
    statSync(file);
    return JSON.parse(readFileSync(file, "utf8")) as IngestSnapshot;
  } catch {
    return null;
  }
}

function defaultRejectMock(): boolean {
  return (
    process.env.CI === "true" ||
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production" ||
    process.env.TRENDS_REQUIRE_LIVE === "1"
  );
}

export function evaluateTrendsHealth(options: TrendsHealthOptions = {}): TrendsHealthReport {
  const source = getTrendsSource();
  const snapshot = options.snapshot === undefined ? readSnapshotFromDisk() : options.snapshot;
  const maxAgeMs =
    options.maxAgeMs ?? Number(process.env.TRENDS_HEALTH_MAX_AGE_MS ?? 6 * 60 * 60 * 1000);
  const minItems = options.minItems ?? Number(process.env.TRENDS_HEALTH_MIN_ITEMS ?? 400);
  const maxRequiredFailures =
    options.maxRequiredFailures ?? Number(process.env.TRENDS_HEALTH_MAX_REQUIRED_FAILURES ?? 8);
  const rejectMock = options.rejectMock ?? defaultRejectMock();

  const issues: TrendsHealthIssue[] = [];
  const failedSources = (snapshot?.sources ?? [])
    .filter((row) => !row.ok)
    .map((row) => ({
      id: row.id,
      error: row.error,
      optional: isOptionalIngestSource(row.id),
    }));
  const requiredFailed = failedSources.filter((row) => !row.optional);
  const updatedAt = snapshot?.updatedAt;
  const parsedAge = updatedAt ? Date.now() - Date.parse(updatedAt) : undefined;
  const ageMs = parsedAge != null && Number.isFinite(parsedAge) ? parsedAge : undefined;
  const itemCount = snapshot?.items?.length ?? 0;

  if (rejectMock && source === "mock") {
    issues.push({
      code: "mock_source",
      level: "error",
      message:
        "TRENDS_DATA_SOURCE=mock — set TRENDS_DATA_SOURCE=live (or unset) so rankings use the crawler snapshot.",
    });
  }

  if (!snapshot) {
    issues.push({
      code: "missing_snapshot",
      level: "error",
      message: "src/data/ingestion/snapshot.json is missing or unreadable.",
    });
  } else if (itemCount < minItems) {
    issues.push({
      code: "empty_snapshot",
      level: "error",
      message: `Snapshot has ${itemCount} items (minimum ${minItems}).`,
    });
  }

  if (snapshot && ageMs != null && ageMs > maxAgeMs) {
    const hours = (ageMs / 3_600_000).toFixed(1);
    const maxHours = (maxAgeMs / 3_600_000).toFixed(1);
    issues.push({
      code: "stale_snapshot",
      level: "error",
      message: `Snapshot is ${hours}h old (max ${maxHours}h). Run npm run ingest:trends or check the ingest-trends workflow.`,
    });
  }

  const presentIds = new Set((snapshot?.sources ?? []).map((row) => row.id));
  const criticalFailed = CRITICAL_SOURCE_IDS.filter((id) => {
    if (!presentIds.has(id)) return false;
    return failedSources.some((row) => row.id === id);
  });
  /** Chart wires that must stay up for LIVE rankings to mean anything. */
  const HARD_CRITICAL_IDS = new Set(["melon", "naver-webtoon-weekly", "naver-movie"]);
  const hardCriticalFailed = criticalFailed.filter((id) => HARD_CRITICAL_IDS.has(id));
  const softCriticalFailed = criticalFailed.filter((id) => !HARD_CRITICAL_IDS.has(id));
  const youtubeOk =
    snapshot?.sources?.some(
      (row) =>
        (row.id === "youtube-trending" || row.id === "youtube-trending-html") && row.ok,
    ) ?? false;
  const youtubePresent =
    presentIds.has("youtube-trending") || presentIds.has("youtube-trending-html");
  const youtubeSoftFail = youtubePresent && !youtubeOk;
  const coreChartsOk = hardCriticalFailed.length === 0;
  const boardRowHealthy = itemCount >= minItems;

  if (hardCriticalFailed.length) {
    issues.push({
      code: "critical_source_failed",
      level: "error",
      message: `Critical source(s) failed: ${hardCriticalFailed.join(", ")}`,
    });
  } else if (softCriticalFailed.length || youtubeSoftFail) {
    // Google News / YouTube HTML often 504 while Melon + Naver charts are fine.
    // Warn (do not fail the cron) when the board still has enough rows.
    const ids = [
      ...softCriticalFailed,
      ...(youtubeSoftFail ? ["youtube-trending"] : []),
    ];
    issues.push({
      code: "critical_source_failed",
      level: boardRowHealthy ? "warn" : "error",
      message: boardRowHealthy
        ? `Soft critical source(s) failed while core charts OK: ${ids.join(", ")}`
        : `Critical source(s) failed: ${ids.join(", ")}`,
    });
  }

  if (requiredFailed.length > maxRequiredFailures) {
    // When the board still has enough rows and core charts are up, treat a
    // burst of scrape timeouts as a warning — common while heatmap Batch and
    // ingest share outbound quota.
    const boardHealthy = boardRowHealthy && coreChartsOk;
    issues.push({
      code: "too_many_failures",
      level: boardHealthy ? "warn" : "error",
      message: `${requiredFailed.length} required sources failed (max ${maxRequiredFailures}): ${requiredFailed
        .slice(0, 12)
        .map((row) => row.id)
        .join(", ")}`,
    });
  }

  if (options.rejectUsedPrevious && options.usedPreviousSnapshot) {
    // Soften when the only pressure was optional family timeouts (common while
    // heatmap Batch shares Serper/Naver/YouTube quota). Keep a hard fail when
    // required sources also blew up or the board is critically empty.
    const onlyOptionalPressure =
      requiredFailed.length === 0 && itemCount >= Math.max(200, Math.floor(minItems * 0.5));
    issues.push({
      code: "used_previous_snapshot",
      level: onlyOptionalPressure ? "warn" : "error",
      message: onlyOptionalPressure
        ? "Ingest reused the previous snapshot after optional family timeouts; board still has enough rows."
        : "Ingest fell back to the previous snapshot instead of a fresh crawl.",
    });
  }

  return {
    ok: !issues.some((issue) => issue.level === "error"),
    source,
    updatedAt,
    ageMs,
    itemCount,
    sourceCount: snapshot?.sources?.length ?? 0,
    failedCount: failedSources.length,
    requiredFailedCount: requiredFailed.length,
    failedSources,
    issues,
  };
}
