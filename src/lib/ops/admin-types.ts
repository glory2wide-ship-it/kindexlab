import type { ADMIN_REFRESH_SCHEDULE } from "@/lib/ops/admin-schedule";

export type AdminOpsItemRow = {
  name: string;
  category: string;
  categoryLabel: string;
  status: "ok" | "fail" | "skip";
  estimatedKrw: number;
  estimatedKrwLabel: string;
  pipeline: string;
  kind?: string;
  meta?: string;
  reason?: string;
};

export type AdminOpsCategoryRow = {
  category: string;
  categoryLabel: string;
  ok: number;
  fail: number;
  skip: number;
  estimatedKrw: number;
  estimatedKrwLabel: string;
};

/** Client-safe shape of /admin dashboard payload (no server-only imports). */
export type AdminDashboardPayload = {
  generatedAt: string;
  editionDate: string;
  schedule: typeof ADMIN_REFRESH_SCHEDULE;
  daily: {
    editionDate: string;
    generationOk: number;
    generationFail: number;
    generationSkip: number;
    generationKrw: number;
    boardRefreshKrw: number;
    boardRefreshOk: number;
    boardRefreshFail: number;
    boardsRefreshed: number;
    generationKrwLabel: string;
    boardRefreshKrwLabel: string;
    hasData: boolean;
    dateLabel: string;
    updatedAt: string;
    byCategory: AdminOpsCategoryRow[];
    byItem: AdminOpsItemRow[];
  };
  traffic: {
    dailyVisitors: number;
    activeVisitors: number;
    note?: string | null;
    topBriefings: Array<{ slug: string; title: string; path: string; count: number }>;
    topRankings: Array<{ slug: string; title: string; path: string; count: number }>;
  };
  webHealth: {
    level: string;
    checkedAt: string;
    updatedAt: string;
    checks: Array<{ id: string; label: string; level: string; detail: string }>;
  };
  liveFill: {
    level: string;
    checkedAt: string;
    updatedAt: string;
    snapshotItems: number;
    snapshotAgeMinutes: number | null;
    landingLiveLead: number;
    screenCap: number;
    landingLivePct: number;
    notes: string[];
    channels: Array<{
      channel: string;
      label: string;
      level: string;
      livePct: number;
      fillPct: number;
      boardCount: number;
    }>;
  };
};
