"use client";

import { KstClock } from "@/components/layout/KstClock";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const LIVE_GREEN = "#22c55e";

/** Green LIVE pill: dot + label blink together on a 3s cycle. */
function LiveBadge() {
  return (
    <span
      className="header-live-blink inline-flex shrink-0 rounded-full border-none bg-emerald-50 px-2 py-0.5 font-sans dark:bg-emerald-950/40 md:px-2.5"
      aria-label="실시간 집계"
    >
      <span className="flex w-full items-center justify-center gap-1 text-center">
        <span
          className="inline-flex h-[7.2px] w-[7.2px] shrink-0 rounded-full md:h-[8.5px] md:w-[8.5px]"
          style={{ backgroundColor: LIVE_GREEN }}
          aria-hidden
        />
        <span
          data-live-label
          className="font-bold tracking-[0.1em] text-[11.63px] md:text-[13.685px]"
          style={{ color: LIVE_GREEN }}
        >
          LIVE
        </span>
      </span>
    </span>
  );
}

/**
 * Desktop (md+): clock + LIVE + theme. Search sits on the section-tab row.
 * Mobile: LIVE + theme only.
 */
export function HeaderRightCluster() {
  return (
    <div
      data-header-right
      className="flex min-w-0 shrink-0 items-center overflow-visible md:ml-auto"
    >
      <div className="hidden min-w-0 flex-1 items-center justify-end px-1 sm:px-2 md:flex md:px-3">
        <KstClock />
      </div>
      <div className="flex shrink-0 items-center gap-1 md:gap-2.5">
        <LiveBadge />
        <ThemeToggle />
      </div>
    </div>
  );
}
