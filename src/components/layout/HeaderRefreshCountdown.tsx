"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { FlipBoardText } from "@/components/dashboard/FlipBoardNumber";
import { isNavigating } from "@/lib/nav/progress";
import { DEFAULT_TRENDS_REVALIDATE_SEC, formatRefreshClock } from "@/lib/refresh";

/**
 * Mobile heatmap countdown (md+ unused / inactive).
 * Shows MM:SS and triggers router.refresh() when the interval elapses.
 */
export function HeaderRefreshCountdown({
  intervalSec = DEFAULT_TRENDS_REVALIDATE_SEC,
}: {
  intervalSec?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [remainingSec, setRemainingSec] = useState(intervalSec);
  const [active, setActive] = useState(false);
  const deadlineRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setActive(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!active) return;
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
      startTransition(() => router.refresh());
    }, 1000);
    return () => window.clearInterval(tick);
  }, [active, intervalSec, router]);

  if (!active) return null;

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={
        pending ? "대시보드 갱신 중" : `다음 갱신 ${Math.max(0, Math.floor(remainingSec))}초`
      }
      className="inline-flex h-[25.5px] shrink-0 items-center justify-center gap-1 rounded-md border border-[#16a34a] bg-[#16a34a] px-1.5 index-gothic font-sans font-bold text-white"
      style={{ fontWeight: 700 }}
    >
      <span className="text-[12.007px] font-bold leading-none tracking-tight whitespace-nowrap text-white">
        KinDex Live
      </span>
      <span className="refresh-countdown text-[14.675px] font-bold tabular-nums leading-none text-white">
        {pending ? "…" : <FlipBoardText text={formatRefreshClock(remainingSec)} />}
      </span>
    </div>
  );
}
