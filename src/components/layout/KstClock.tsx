"use client";

import { useEffect, useState } from "react";
import { formatLiveKst } from "@/lib/format";

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
      className="flex min-w-[10.4rem] flex-col items-end font-sans leading-tight"
      aria-label="한국 표준시"
    >
      <span className="hidden text-[14.4px] font-medium tracking-tight text-muted sm:inline">
        {dateLine}
      </span>
      <span className="text-[17.3px] font-semibold tabular-nums tracking-tight">
        {timeLine}
        <span className="ml-1 text-[14.4px] font-medium text-muted">KST</span>
      </span>
    </time>
  );
}
