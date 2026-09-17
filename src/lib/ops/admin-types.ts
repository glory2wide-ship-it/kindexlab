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

export type AdminOpsArticleTypeRow = {
  type: "today-briefing" | "today-insight" | "today-analysis";
  typeLabel: string;
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
  /** Past KST dates with stored ops/traffic/cost snapshots (newest first). */
  availableDates: string[];
  schedule: typeof ADMIN_REFRESH_SCHEDULE;
  categoryInfoRefresh: Array<{
    id: string;
    label: string;
    cadenceLabel: string;
    reason: string;
    channelsLabel: string;
    intervalMs: number;
    lastUpdatedAt: string;
    nextUpdateAt: string;
    overdue: boolean;
    run: {
      ok: number;
      fail: number;
      skip: number;
      fillRateAvg: number;
      usedFallback: number;
      lastRunAt?: string;
    };
    fillRateLabel: string;
    fallbackLabel: string;
  }>;
  /** Newest-first warm/batch snapshots for 상세페이지 정보수집. */
  categoryInfoRefreshHistory: Array<{
    id: string;
    at: string;
    source: string;
    label: string;
    entityCount: number;
    ok: number;
    fail: number;
    skip: number;
    fillRateAvg: number;
    fillRateLabel: string;
    usedFallback: number;
    tiers: Array<{
      id: string;
      ok: number;
      fail: number;
      skip: number;
      fillRateLabel: string;
    }>;
  }>;
  detailCollectApiCost: {
    dayKst: string;
    youtube: {
      units: number;
      calls: number;
      estimatedKrw: number;
      estimatedKrwLabel: string;
      note: string;
    };
    openai: {
      promptTokens: number;
      completionTokens: number;
      calls: number;
      estimatedKrw: number;
      estimatedKrwLabel: string;
      note: string;
    };
    gemini: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      calls: number;
      estimatedKrw: number;
      estimatedKrwLabel: string;
      note: string;
    };
    totalEstimatedKrw: number;
    totalEstimatedKrwLabel: string;
    updatedAt: string;
  };
  detailCollectApiCostHistory: Array<{
    dayKst: string;
    youtubeKrwLabel: string;
    openaiKrwLabel: string;
    geminiKrwLabel: string;
    totalKrwLabel: string;
    youtubeUnits: number;
    openaiCalls: number;
    geminiCalls: number;
    updatedAt: string;
  }>;
  publicDataFailLedger: {
    updatedAt: string;
    failures: Array<{
      id: string;
      channel: string;
      entityName: string;
      kind: string;
      reason: string;
      at: string;
      retries: number;
    }>;
    retryQueue: Array<{
      entityName: string;
      channel: string;
      reason: string;
      enqueuedAt: string;
      attempts: number;
    }>;
  };
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
    /** Present when digests split live/batch; admin UI prefers Batch. */
    generationBatchKrw?: number;
    generationLiveKrw?: number;
    byCategory: AdminOpsCategoryRow[];
    byArticleType: AdminOpsArticleTypeRow[];
    byItem: AdminOpsItemRow[];
  };
  traffic: {
    day?: string;
    dailyVisitors: number;
    activeVisitors: number;
    activeWindowMinutes: number;
    storage?: string;
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
