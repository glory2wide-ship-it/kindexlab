"use client";

import { formatRefreshCountdown } from "@/lib/refresh";

/** Keep the same outer box as the neighboring "시세 산출 방식" control (30px). */
const SHELL_CLASS =
  "inline-flex min-w-[8.64rem] shrink-0 items-center justify-center rounded-md border border-line bg-accent px-3 text-xs font-medium tabular-nums text-black";
const SHELL_STYLE = { height: 30, boxSizing: "border-box" as const };
const CLOCK_STYLE = { textAlign: "center" as const, lineHeight: 1 };

export function HeatmapCountdownFallback() {
  return (
    <div role="timer" className={SHELL_CLASS} style={SHELL_STYLE} aria-hidden>
      <span className="refresh-countdown w-full text-center" style={CLOCK_STYLE}>
        Update 3 min
      </span>
    </div>
  );
}

export function HeatmapCountdown({
  remainingSec,
  refreshing = false,
}: {
  remainingSec: number;
  refreshing?: boolean;
}) {
  const label = refreshing ? "Updating…" : formatRefreshCountdown(remainingSec);

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={
        refreshing
          ? "대시보드 갱신 중"
          : `다음 갱신 ${Math.max(0, Math.floor(remainingSec))}초`
      }
      className={SHELL_CLASS}
      style={SHELL_STYLE}
    >
      <span className="refresh-countdown w-full text-center" style={CLOCK_STYLE}>
        {label}
      </span>
    </div>
  );
}
