import { formatKrw } from "@/lib/ops/gemini-usage";
import { evaluateLiveFillStatus, evaluateWebHealth } from "@/lib/ops/admin-health";
import { ADMIN_REFRESH_SCHEDULE } from "@/lib/ops/admin-schedule";
import { loadOpsDigestsForDate, summarizeDay } from "@/lib/ops/ops-digest";
import { getTrafficSnapshot } from "@/lib/analytics/traffic";

export { ADMIN_REFRESH_SCHEDULE } from "@/lib/ops/admin-schedule";

function latestDigestAt(digests: { generatedAt: string }[]): string | null {
  if (!digests.length) return null;
  return digests.reduce(
    (latest, row) => (row.generatedAt > latest ? row.generatedAt : latest),
    digests[0]!.generatedAt,
  );
}

export async function buildAdminDashboard(editionDate?: string) {
  const digests = await loadOpsDigestsForDate(editionDate);
  const daily = summarizeDay(digests);
  const generatedAt = new Date().toISOString();
  const [webHealth, liveFill, traffic] = await Promise.all([
    evaluateWebHealth(),
    evaluateLiveFillStatus(),
    getTrafficSnapshot(editionDate),
  ]);

  return {
    generatedAt,
    editionDate: daily.editionDate,
    schedule: ADMIN_REFRESH_SCHEDULE,
    daily: {
      ...daily,
      generationKrwLabel: formatKrw(daily.generationKrw),
      boardRefreshKrwLabel: formatKrw(daily.boardRefreshKrw),
      hasData: digests.length > 0,
      /** Calendar day this cost board is for (KST). */
      dateLabel: daily.editionDate,
      /** Latest digest write time, else this dashboard build. */
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
