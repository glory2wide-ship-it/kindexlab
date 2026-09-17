/**
 * Warm / refresh ItemDetailCategoryInfo for overdue tiers (or all entities).
 *   npx tsx scripts/warm-category-info.ts
 *   npx tsx scripts/warm-category-info.ts --all
 *   npx tsx scripts/warm-category-info.ts --tier=other_news --concurrency=4
 */
import { getRankings } from "../src/lib/api";
import { resolveCategoryInfoChannel } from "../src/lib/entity/category-info/channel";
import { buildCategoryInfoPayload } from "../src/lib/entity/category-info/build";
import { enrichCategoryInfoPayload } from "../src/lib/entity/category-info/enrich";
import {
  buildCategoryInfoRefreshStatus,
  touchCategoryInfoRefreshTier,
  recordCategoryInfoRefreshRun,
  resetCategoryInfoRefreshRuns,
  snapshotCategoryInfoRefreshHistory,
} from "../src/lib/entity/category-info/refresh-status";
import {
  resolveCategoryInfoRefreshTier,
  type CategoryInfoRefreshTierId,
} from "../src/lib/entity/category-info/refresh-policy";

const ALL = process.argv.includes("--all");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || 0);
const CONCURRENCY = Math.max(
  1,
  Number(process.argv.find((a) => a.startsWith("--concurrency="))?.split("=")[1] || 3),
);
const TIER_FILTER = process.argv
  .find((a) => a.startsWith("--tier="))
  ?.split("=")[1] as CategoryInfoRefreshTierId | undefined;

async function main() {
  const status = buildCategoryInfoRefreshStatus();
  const overdue = new Set(
    status
      .filter((row) => (TIER_FILTER ? row.id === TIER_FILTER : row.overdue || ALL))
      .map((row) => row.id),
  );
  console.log(
    "tiers",
    status.map((r) => `${r.id}:${r.overdue ? "OVERDUE" : "ok"}`).join(" "),
  );
  if (!overdue.size) {
    console.log("no matching tiers");
    return;
  }

  // This warm window's ok/fail/skip/fillRate become the Admin "최근 갱신 기록".
  resetCategoryInfoRefreshRuns([...overdue]);

  const payload = await getRankings();
  const targets = payload.items.filter((entity) => {
    const channel = resolveCategoryInfoChannel(entity).channel;
    const tier = resolveCategoryInfoRefreshTier(channel);
    return overdue.has(tier.id);
  });
  const slice = LIMIT > 0 ? targets.slice(0, LIMIT) : targets;
  console.log(`warming ${slice.length}/${targets.length} entities concurrency=${CONCURRENCY}`);

  let ok = 0;
  let fail = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < slice.length) {
      const index = cursor;
      cursor += 1;
      const entity = slice[index]!;
      const channel = resolveCategoryInfoChannel(entity).channel;
      try {
        const base = buildCategoryInfoPayload(entity);
        const enriched = await enrichCategoryInfoPayload(base);
        touchCategoryInfoRefreshTier(enriched.channel);
        const fillRate = enriched.fillRate ?? 0;
        const realLinks = (enriched.links ?? []).filter(
          (link) =>
            link.href &&
            !/search\.(naver|daum)|google\.com\/search|news\.google\.com\/search/i.test(link.href),
        ).length;
        const visitorOk =
          fillRate >= 0.5 ||
          !enriched.sparse ||
          (enriched.rows?.length ?? 0) >= 2 ||
          realLinks >= 3;
        recordCategoryInfoRefreshRun({
          channel: enriched.channel,
          status: visitorOk ? "ok" : fillRate > 0 || realLinks > 0 ? "skip" : "fail",
          fillRate,
          usedFallback: enriched.usedFallback,
        });
        ok += 1;
        if (ok % 10 === 0) console.log(`… ${ok}/${slice.length}`);
      } catch (err) {
        fail += 1;
        recordCategoryInfoRefreshRun({
          channel,
          status: "fail",
          fillRate: 0,
          usedFallback: true,
        });
        console.warn(
          "fail",
          entity.slug,
          entity.name,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const history = snapshotCategoryInfoRefreshHistory({
    source: "warm",
    label: ALL ? "전 종목 맞춤 정보 갱신" : "기한 도래 티어 맞춤 정보 갱신",
    entityCount: slice.length,
    tierIds: [...overdue],
  });
  console.log(
    `done ok=${ok} fail=${fail} history=${history.id} fill=${(history.fillRateAvg * 100).toFixed(1)}%`,
  );
  const after = buildCategoryInfoRefreshStatus();
  for (const row of after) {
    console.log(
      `${row.id} overdue=${row.overdue} last=${row.lastUpdatedAt} fill=${row.run.fillRateAvg.toFixed(2)}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
