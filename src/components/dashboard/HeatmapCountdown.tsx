"use client";

import { useEffect, useRef, useState } from "react";
import { FlipBoardText } from "@/components/dashboard/FlipBoardNumber";
import { isNavigating } from "@/lib/nav/progress";
import { DEFAULT_TRENDS_REVALIDATE_SEC, formatRefreshClock } from "@/lib/refresh";

/** Keep the same outer box as the neighboring "랭킹 산출 방식" control (30px). */
/** Background matches heatmap legend +2% green (second from right) (#16a34a). */
const SHELL_CLASS =
  "index-gothic inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-[#16a34a] bg-[#16a34a] px-3 font-sans font-bold text-white";
const SHELL_STYLE = { height: 30, boxSizing: "border-box" as const, fontWeight: 700 };
/** Prior 13.068 / 15.972 +5% → 13.721 / 16.771. */
const LABEL_CLASS = "text-[13.721px] font-bold leading-none tracking-tight whitespace-nowrap text-white";
const CLOCK_CLASS = "refresh-countdown text-[16.771px] font-bold tabular-nums leading-none text-white";

export function HeatmapCountdownFallback() {
  return (
    <div role="timer" className={SHELL_CLASS} style={SHELL_STYLE} aria-hidden>
      <span className={LABEL_CLASS}>LIVE KinDex</span>
      <span className={CLOCK_CLASS}>
        <FlipBoardText text="03:00" />
      </span>
    </div>
  );
}

/**
 * Owns the 1s countdown locally so parent heatmaps do not re-render (and
 * re-layout d3) every second. Optional `onExpire` fires about every interval.
 * Desktop copy matches the mobile header countdown: "LIVE KinDex MM:SS".
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
      <span className={LABEL_CLASS}>LIVE KinDex</span>
      <span className={CLOCK_CLASS}>
        {refreshing ? "…" : <FlipBoardText text={formatRefreshClock(remainingSec)} />}
      </span>
    </div>
  );
}
