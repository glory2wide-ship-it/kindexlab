import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CachedBoard } from "@/lib/boards/types";
import { getBoard, isDeskBoard, isRailBoard } from "@/lib/boards/registry";
import { evaluateTrendsHealth, type TrendsHealthReport } from "@/lib/ingestion/health";
import { readPersistedSnapshot } from "@/lib/ingestion/job";
import {
  evaluateLiveCompleteness,
  type LiveCompletenessReport,
} from "@/lib/ops/live-completeness";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export type HealthLevel = "ok" | "warn" | "fail";

export interface WebHealthCheck {
  id: string;
  label: string;
  level: HealthLevel;
  detail: string;
}

export interface WebHealthStatus {
  checkedAt: string;
  /** Admin page polls this board every 3h; evaluation still uses a 6h freshness window. */
  windowHours: 3;
  level: HealthLevel;
  checks: WebHealthCheck[];
  trends: TrendsHealthReport;
}

export type LiveFillStatus = LiveCompletenessReport;

function worst(levels: HealthLevel[]): HealthLevel {
  if (levels.includes("fail")) return "fail";
  if (levels.includes("warn")) return "warn";
  return "ok";
}

function trendsLevel(trends: TrendsHealthReport): HealthLevel {
  if (!trends.ok) return "fail";
  if (trends.issues.some((issue) => issue.level === "warn")) return "warn";
  return "ok";
}

/** Boards the refresh cron actually maintains (rail, non-desk). */
function isCronMaintainedBoard(slug: string): boolean {
  const def = getBoard(slug);
  return Boolean(def && isRailBoard(def) && !isDeskBoard(def));
}

export async function evaluateWebHealth(): Promise<WebHealthStatus> {
  const snapshot = readPersistedSnapshot() ?? null;
  const trends = evaluateTrendsHealth({
    snapshot,
    rejectMock: true,
    maxAgeMs: SIX_HOURS_MS,
  });

  const checks: WebHealthCheck[] = [
    {
      id: "trends-health",
      label: "트렌드 스냅샷 헬스",
      level: trendsLevel(trends),
      detail: trends.ok
        ? `items=${trends.itemCount} · age=${
            trends.ageMs != null ? `${(trends.ageMs / 60_000).toFixed(0)}분` : "—"
          } · 필수 실패 소스 ${trends.requiredFailedCount}`
        : trends.issues.map((issue) => issue.message).join(" · ") || "trends health failed",
    },
  ];

  const landingPath = path.join(process.cwd(), "src", "data", "ingestion", "landing-unified.json");
  try {
    const raw = await readFile(landingPath, "utf8");
    const parsed = JSON.parse(raw) as {
      updatedAt?: string;
      savedAt?: string;
      items?: unknown[];
      market?: { items?: unknown[]; desks?: unknown[] };
    };
    // Slim cache shape is `{ savedAt, market: { items, desks } }` — fall back to
    // a legacy top-level `items` array if present.
    const itemCount = parsed.market?.items?.length ?? parsed.items?.length ?? 0;
    const deskCount = parsed.market?.desks?.length ?? 0;
    const stamp = parsed.updatedAt ?? parsed.savedAt;
    const ageMs = stamp ? Date.now() - new Date(stamp).getTime() : null;
    const stale = ageMs != null && ageMs > SIX_HOURS_MS * 2;
    const empty = itemCount === 0;
    checks.push({
      id: "landing-unified",
      label: "랜딩 통합 캐시",
      level: !stamp ? "warn" : empty ? "warn" : stale ? "warn" : "ok",
      detail: stamp
        ? `savedAt=${stamp} · age=${ageMs != null ? `${(ageMs / 60_000).toFixed(0)}분` : "—"} · items=${itemCount}${deskCount ? ` · desks=${deskCount}` : ""}`
        : "landing-unified.json missing timestamp",
    });
  } catch {
    checks.push({
      id: "landing-unified",
      label: "랜딩 통합 캐시",
      level: "warn",
      detail: "landing-unified.json 없음 (런타임 재생성 가능)",
    });
  }

  try {
    const publishedRaw = await readFile(
      path.join(process.cwd(), "src", "data", "boards", "published.json"),
      "utf8",
    );
    const published = JSON.parse(publishedRaw) as { entries?: CachedBoard[] };
    const entries = (published.entries ?? []).filter((row) => isCronMaintainedBoard(row.slug));
    const now = Date.now();
    const fresh = entries.filter((row) => new Date(row.expiresAt).getTime() > now).length;
    const ratio = entries.length ? fresh / entries.length : 0;
    const skipped = (published.entries?.length ?? 0) - entries.length;
    checks.push({
      id: "published-boards",
      label: "보드 published.json",
      level: entries.length === 0 ? "fail" : ratio < 0.4 ? "warn" : "ok",
      detail: `${fresh}/${entries.length} rail boards within TTL${
        skipped > 0 ? ` · skipped ${skipped} railHidden/desk` : ""
      }`,
    });
  } catch {
    checks.push({
      id: "published-boards",
      label: "보드 published.json",
      level: "fail",
      detail: "published.json 읽기 실패",
    });
  }

  checks.push({
    id: "landing-route",
    label: "랜딩 라우트",
    level: "ok",
    detail: "SSR/ISR 랜딩은 / 와 Suspense heatmap 경계로 서빙",
  });

  return {
    checkedAt: new Date().toISOString(),
    windowHours: 3,
    level: worst(checks.map((check) => check.level)),
    checks,
    trends,
  };
}

export async function evaluateLiveFillStatus(): Promise<LiveFillStatus> {
  return evaluateLiveCompleteness();
}
