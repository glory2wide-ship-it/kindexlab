"use client";

import { useEffect, useState } from "react";
import { FlipBoardText } from "@/components/dashboard/FlipBoardNumber";
import { formatLiveKst } from "@/lib/format";

/**
 * Header KST clock — same gothic face + airport flip digits as the
 * LIVE KinDex countdown (compact ink-on-panel glyphs).
 */
export function KstClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const { dateLine, timeLine } = now
    ? formatLiveKst(now)
    : { dateLine: "\u00a0", timeLine: "--:--:--" };

  return (
    <time
      suppressHydrationWarning
      dateTime={now?.toISOString()}
      className="index-gothic flex min-w-[6.4rem] flex-col items-center justify-center py-0 text-center font-sans leading-none"
      aria-label="한국 표준시"
    >
      <span
        className="hidden font-medium tracking-tight text-muted sm:inline"
        style={{ fontSize: 13 }}
      >
        {dateLine}
      </span>
      <span
        className="kst-flip-clock mt-0.5 inline-flex items-center font-semibold tabular-nums tracking-tight"
        style={{ fontSize: 15.5 }}
      >
        <FlipBoardText text={timeLine} />
        <span className="ml-1 font-medium text-muted" style={{ fontSize: 13 }}>
          KST
        </span>
      </span>
    </time>
  );
}
