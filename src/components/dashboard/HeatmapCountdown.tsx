"use client";

import { useEffect, useRef, useState } from "react";
import { isNavigating } from "@/lib/nav/progress";
import { DEFAULT_TRENDS_REVALIDATE_SEC, formatRefreshCountdown } from "@/lib/refresh";

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

/**
 * Owns the 1s countdown locally so parent heatmaps do not re-render (and
 * re-layout d3) every second. Optional `onExpire` fires about every interval.
 */
export function HeatmapCountdown({
  intervalSec = DEFAULT_TRENDS_REVALIDATE_SEC,
  refreshing = false,
  onExpire,
}: {
  intervalSec?: number;
  refreshing?: boolean;
  onExpire?: () => void;
}) {
  const [remainingSec, setRemainingSec] = useState(intervalSec);
  const deadlineRef = useRef(0);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const intervalMs = Math.max(1, intervalSec) * 1000;
    deadlineRef.current = Date.now() + intervalMs;
    setRemainingSec(intervalSec);
    const tick = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      const remainingMs = deadlineRef.current - Date.now();
      setRemainingSec(Math.max(0, Math.ceil(remainingMs / 1000)));
      if (remainingMs > 0) return;
      if (isNavigating()) {
        deadlineRef.current = Date.now() + intervalMs;
        return;
      }
      deadlineRef.current = Date.now() + intervalMs;
      onExpireRef.current?.();
    }, 1000);
    return () => window.clearInterval(tick);
  }, [intervalSec]);

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
