import type { DailyBriefing } from "@/lib/types";

/**
 * Legacy seed (2026-08-24) — retired from all public surfaces.
 * Kept as an empty placeholder so old imports do not break builds.
 * Public editorial content starts 2026-09-04 00:00 KST.
 */
export const dailyBriefing: DailyBriefing = {
  id: "brief-retired",
  slug: "retired",
  title: "",
  excerpt: "",
  publishedAt: "2026-09-04T00:00:00+09:00",
  updatedAt: "2026-09-04T00:00:00+09:00",
  readingMinutes: 0,
  wordCount: 0,
  sections: [],
};
