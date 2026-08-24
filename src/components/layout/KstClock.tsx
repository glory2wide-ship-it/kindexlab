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
      className="flex min-w-[7.25rem] flex-col items-end leading-tight"
      aria-label="한국 표준시"
    >
      <span className="hidden font-mono text-[10px] text-muted sm:inline">{dateLine}</span>
      <span className="font-mono text-xs font-semibold tabular-nums tracking-tight">
        {timeLine}
        <span className="ml-1 text-[10px] font-medium text-muted">KST</span>
      </span>
    </time>
  );
}
