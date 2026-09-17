import { formatKrw } from "@/lib/ops/gemini-usage";
import { evaluateLiveFillStatus, evaluateWebHealth } from "@/lib/ops/admin-health";
import { ADMIN_REFRESH_SCHEDULE } from "@/lib/ops/admin-schedule";
import {
  listDetailCollectApiCostHistory,
  snapshotDetailCollectApiCost,
} from "@/lib/ops/detail-collect-api-cost";
import { listOpsEditionDates, loadOpsDigestsForDate, summarizeDay } from "@/lib/ops/ops-digest";
import { getTrafficSnapshot, listTrafficDays } from "@/lib/analytics/traffic";
import { buildCategoryInfoRefreshStatus, listCategoryInfoRefreshHistory } from "@/lib/entity/category-info/refresh-status";
import { snapshotPublicDataFailLedger } from "@/lib/public-data/fail-ledger";
import { kstDateString } from "@/lib/briefing/dates";
import { CATEGORY_INFO_REFRESH_TIERS } from "@/lib/entity/category-info/refresh-policy";

export { ADMIN_REFRESH_SCHEDULE } from "@/lib/ops/admin-schedule";

function latestDigestAt(digests: { generatedAt: string }[]): string | null {
  if (!digests.length) return null;
  return digests.reduce(
    (latest, row) => (row.generatedAt > latest ? row.generatedAt : latest),
    digests[0]!.generatedAt,
  );
}

function mergeDates(...lists: string[][]): string[] {
  const set = new Set<string>();
  for (const list of lists) {
    for (const d of list) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) set.add(d);
    }
  }
  const today = kstDateString();
  set.add(today);
  return [...set].sort((a, b) => b.localeCompare(a)).slice(0, 45);
}

export async function buildAdminDashboard(editionDate?: string) {
  const digests = await loadOpsDigestsForDate(editionDate);
  const daily = summarizeDay(digests);
  const generatedAt = new Date().toISOString();
  const targetDay = editionDate && /^\d{4}-\d{2}-\d{2}$/.test(editionDate)
    ? editionDate
    : daily.editionDate;
  const [webHealth, liveFill, traffic, opsDates, trafficDates] = await Promise.all([
    evaluateWebHealth(),
    evaluateLiveFillStatus(),
    getTrafficSnapshot(targetDay),
    listOpsEditionDates(40),
    listTrafficDays(40),
  ]);
  const categoryInfoRefresh = buildCategoryInfoRefreshStatus();
  const categoryInfoRefreshHistory = listCategoryInfoRefreshHistory(14).map((entry) => ({
    id: entry.id,
    at: entry.at,
    source: entry.source,
    label: entry.label,
    entityCount: entry.entityCount,
    ok: entry.ok,
    fail: entry.fail,
    skip: entry.skip,
    fillRateAvg: entry.fillRateAvg,
    fillRateLabel: `방문자 채움 ${Math.round(entry.fillRateAvg * 100)}%`,
    usedFallback: entry.usedFallback,
    tiers: CATEGORY_INFO_REFRESH_TIERS.filter((tier) => entry.tiers[tier.id]).map((tier) => {
      const run = entry.tiers[tier.id]!;
      return {
        id: tier.id,
        ok: run.ok,
        fail: run.fail,
        skip: run.skip,
        fillRateLabel: `${Math.round(run.fillRateAvg * 100)}%`,
      };
    }),
  }));
  const detailCollectApiCost = snapshotDetailCollectApiCost(targetDay);
  const detailCollectApiCostHistory = listDetailCollectApiCostHistory(14);
  const publicDataFailLedger = snapshotPublicDataFailLedger(30);
  const availableDates = mergeDates(
    opsDates,
    trafficDates,
    detailCollectApiCostHistory.map((row) => row.dayKst),
    [targetDay],
  );

  return {
    generatedAt,
    editionDate: targetDay,
    availableDates,
    schedule: ADMIN_REFRESH_SCHEDULE,
    categoryInfoRefresh: categoryInfoRefresh.map((row) => ({
      id: row.id,
      label: row.label,
      cadenceLabel: row.cadenceLabel,
      reason: row.reason,
      channelsLabel: row.channelsLabel,
      intervalMs: row.intervalMs,
      lastUpdatedAt: row.lastUpdatedAt,
      nextUpdateAt: row.nextUpdateAt,
      overdue: row.overdue,
      run: row.run,
      fillRateLabel: `방문자 채움 ${Math.round(row.run.fillRateAvg * 100)}%`,
      fallbackLabel:
        row.run.usedFallback > 0 ? `폴백 ${row.run.usedFallback}` : "폴백 없음",
    })),
    categoryInfoRefreshHistory,
    detailCollectApiCost,
    detailCollectApiCostHistory,
    publicDataFailLedger,
    daily: {
      ...daily,
      generationKrwLabel: formatKrw(daily.generationKrw),
      boardRefreshKrwLabel: formatKrw(daily.boardRefreshKrw),
      hasData: digests.length > 0,
      dateLabel: daily.editionDate || targetDay,
      updatedAt: latestDigestAt(digests) ?? generatedAt,
      byCategory: daily.byCategory.map((row) => ({
        ...row,
        estimatedKrwLabel: formatKrw(row.estimatedKrw),
      })),
      byArticleType: daily.byArticleType.map((row) => ({
        ...row,
        estimatedKrwLabel: formatKrw(row.estimatedKrw),
      })),
      byItem: daily.byItem.map((row) => ({
        ...row,
        estimatedKrwLabel: formatKrw(row.estimatedKrw),
      })),
    },
    traffic,
    webHealth: {
      ...webHealth,
      updatedAt: webHealth.checkedAt,
    },
    liveFill: {
      ...liveFill,
      updatedAt: liveFill.checkedAt,
    },
  };
}

export type AdminDashboardPayload = Awaited<ReturnType<typeof buildAdminDashboard>>;
