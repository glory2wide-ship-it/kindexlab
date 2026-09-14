import { formatKrw } from "@/lib/ops/gemini-usage";
import { evaluateLiveFillStatus, evaluateWebHealth } from "@/lib/ops/admin-health";
import { loadOpsDigestsForDate, summarizeDay } from "@/lib/ops/ops-digest";
import { getTrafficSnapshot } from "@/lib/analytics/traffic";

export async function buildAdminDashboard(editionDate?: string) {
  const digests = await loadOpsDigestsForDate(editionDate);
  const daily = summarizeDay(digests);
  const [webHealth, liveFill, traffic] = await Promise.all([
    evaluateWebHealth(),
    evaluateLiveFillStatus(),
    getTrafficSnapshot(editionDate),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    editionDate: daily.editionDate,
    daily: {
      ...daily,
      generationKrwLabel: formatKrw(daily.generationKrw),
      boardRefreshKrwLabel: formatKrw(daily.boardRefreshKrw),
      hasData: digests.length > 0,
    },
    traffic,
    webHealth,
    liveFill,
  };
}

export type AdminDashboardPayload = Awaited<ReturnType<typeof buildAdminDashboard>>;
