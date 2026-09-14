/** Client-safe refresh cadence for /admin (no server-only imports). */
export const ADMIN_REFRESH_SCHEDULE = {
  daily: {
    hourKst: 11,
    minuteKst: 10,
    label: "매일 오전 11:10 (KST)",
  },
  liveFill: {
    everyMs: 30 * 60 * 1000,
    label: "30분마다",
  },
  webHealth: {
    everyMs: 3 * 60 * 60 * 1000,
    label: "3시간마다",
  },
} as const;
