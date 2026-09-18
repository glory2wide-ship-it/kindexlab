import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { buildCategoryInfoPayload } from "@/lib/entity/category-info/build";
import { resolveCategoryInfoChannel } from "@/lib/entity/category-info/channel";
import { enrichCategoryInfoPayload } from "@/lib/entity/category-info/enrich";
import {
  categoryInfoRevalidateSec,
  resolveCategoryInfoRefreshTier,
} from "@/lib/entity/category-info/refresh-policy";
import {
  buildCategoryInfoRefreshStatus,
  recordCategoryInfoRefreshRun,
  touchCategoryInfoRefreshTier,
} from "@/lib/entity/category-info/refresh-status";
import type { CategoryInfoPayload } from "@/lib/entity/category-info/types";
import type { RankingEntity } from "@/lib/types";

/** @deprecated Prefer categoryInfoRevalidateSec(channel). */
export const CATEGORY_INFO_REVALIDATE_SEC = 3600;

/**
 * Cache identity for an entity's category-info pack.
 * Rank / fluctuation are intentionally omitted — they change every ingest tick
 * and were busting the cache on nearly every detail-page visit.
 */
function cacheKey(entity: RankingEntity, channel: string): string[] {
  return [
    "item-detail-category-info-v25-stable-key",
    channel,
    entity.slug,
    entity.type,
    entity.heatmapGroup ?? "",
  ];
}

const DISK_DIR = path.join(process.cwd(), ".next", "cache", "category-info-v25");

function diskFileFor(slug: string): string {
  const safe = slug.replace(/[^\w.\-\uac00-\ud7a3]+/g, "_").slice(0, 180);
  return path.join(DISK_DIR, `${safe || "entity"}.json`);
}

function readDiskPayload(
  slug: string,
  maxAgeMs: number,
): CategoryInfoPayload | null {
  try {
    const file = diskFileFor(slug);
    if (!existsSync(file)) return null;
    const raw = JSON.parse(readFileSync(file, "utf8")) as {
      savedAt?: string;
      payload?: CategoryInfoPayload;
    };
    if (!raw.payload || !raw.savedAt) return null;
    const age = Date.now() - Date.parse(raw.savedAt);
    if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) return null;
    return raw.payload;
  } catch {
    return null;
  }
}

function writeDiskPayload(slug: string, payload: CategoryInfoPayload): void {
  try {
    mkdirSync(DISK_DIR, { recursive: true });
    writeFileSync(
      diskFileFor(slug),
      `${JSON.stringify({ savedAt: new Date().toISOString(), payload })}\n`,
      "utf8",
    );
  } catch {
    /* best-effort local acceleration only */
  }
}

function withRefreshMeta(payload: CategoryInfoPayload): CategoryInfoPayload {
  const tier = resolveCategoryInfoRefreshTier(payload.channel);
  const status = buildCategoryInfoRefreshStatus().find((row) => row.id === tier.id);
  return {
    ...payload,
    refreshLastAt: status?.lastUpdatedAt ?? payload.updatedAt,
    refreshNextAt: status?.nextUpdateAt,
    refreshCadenceLabel: status?.cadenceLabel ?? tier.cadenceLabel,
  };
}

/**
 * Instant local pack (curated / detail-facts) — no network.
 * Used as the progressive Suspense fallback on the detail page.
 */
export function loadCategoryInfoBasePayload(
  entity: RankingEntity,
): CategoryInfoPayload {
  return withRefreshMeta(buildCategoryInfoPayload(entity));
}

async function buildAndEnrich(entity: RankingEntity): Promise<CategoryInfoPayload> {
  const base = buildCategoryInfoPayload(entity);
  try {
    const enriched = await enrichCategoryInfoPayload(base);
    touchCategoryInfoRefreshTier(enriched.channel);
    const fillRate = enriched.fillRate ?? 0;
    const status =
      fillRate >= 0.5 || !enriched.sparse
        ? "ok"
        : fillRate > 0
          ? "skip"
          : "fail";
    recordCategoryInfoRefreshRun({
      channel: enriched.channel,
      status,
      fillRate,
      usedFallback: enriched.usedFallback,
    });
    const withMeta = withRefreshMeta(enriched);
    writeDiskPayload(entity.slug, withMeta);
    return withMeta;
  } catch {
    recordCategoryInfoRefreshRun({
      channel: base.channel,
      status: "fail",
      fillRate: 0,
      usedFallback: true,
    });
    return withRefreshMeta({
      ...base,
      notice:
        base.notice ||
        "실시간 수집이 잠시 지연되어 기본 정보로 표시합니다. 잠시 후 다시 시도해 주세요.",
    });
  }
}

/**
 * Cached builder for ItemDetailCategoryInfo.
 * Prefer disk → Next data cache → live enrich.
 * Revalidate window follows the channel refresh-policy tier.
 */
export async function loadCategoryInfoPayload(
  entity: RankingEntity,
): Promise<CategoryInfoPayload> {
  const channel = resolveCategoryInfoChannel(entity).channel;
  const revalidate = categoryInfoRevalidateSec(channel);

  const disk = readDiskPayload(entity.slug, revalidate * 1000);
  if (disk) return withRefreshMeta(disk);

  const cached = unstable_cache(
    async () => buildAndEnrich(entity),
    cacheKey(entity, channel),
    { revalidate },
  );
  return cached();
}
