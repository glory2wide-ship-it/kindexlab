"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { KstClock } from "@/components/layout/KstClock";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import {
  SEARCH_BUTTON_CLASS,
  SEARCH_FORM_CLASS,
  SEARCH_INPUT_CLASS,
  SEARCH_INPUT_STYLE,
} from "@/components/layout/header-search-ui";

function SearchFallback() {
  return (
    <form action="/search" className={SEARCH_FORM_CLASS}>
      <label htmlFor="site-search" className="sr-only">
        종목·키워드 검색
      </label>
      <input
        id="site-search"
        type="text"
        name="q"
        placeholder="종목·키워드 검색"
        className={SEARCH_INPUT_CLASS}
        style={SEARCH_INPUT_STYLE}
        autoComplete="off"
      />
      <button type="submit" aria-label="검색" className={SEARCH_BUTTON_CLASS}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
      </button>
    </form>
  );
}

const HeaderSearch = dynamic(
  () => import("@/components/layout/HeaderSearch").then((mod) => mod.HeaderSearch),
  { ssr: false, loading: () => <SearchFallback /> },
);

const LIVE_GREEN = "#22c55e";
/** text-sm(14px) × 1.15 */
const LIVE_FONT_SIZE = "16.1px";

/** Green LIVE pill: dot + label blink together on a 3s cycle. */
function LiveBadge() {
  return (
    <span
      className="header-live-blink inline-flex shrink-0 rounded-full border-none bg-emerald-50 px-3 py-1 font-sans dark:bg-emerald-950/40"
      aria-label="실시간 집계"
    >
      <span className="flex w-full items-center justify-center gap-1.5 text-center">
        <span
          className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: LIVE_GREEN }}
          aria-hidden
        />
        <span
          data-live-label
          className="font-bold tracking-[0.1em]"
          style={{ color: LIVE_GREEN, fontSize: LIVE_FONT_SIZE }}
        >
          LIVE
        </span>
      </span>
    </span>
  );
}

/** Centers the clock between the search button center and the LIVE label start. */
function HeaderClockSlot() {
  const slotRef = useRef<HTMLDivElement>(null);
  const [shiftX, setShiftX] = useState(0);

  useEffect(() => {
    const root = slotRef.current?.parentElement;
    if (!root) return;

    const measure = () => {
      const searchBtn = root.querySelector<HTMLElement>('button[aria-label="검색"]');
      const liveLabel = root.querySelector<HTMLElement>("[data-live-label]");
      const slot = slotRef.current;
      if (!searchBtn || !liveLabel || !slot) return;

      const searchRect = searchBtn.getBoundingClientRect();
      const liveRect = liveLabel.getBoundingClientRect();
      const slotRect = slot.getBoundingClientRect();
      const searchCenter = searchRect.left + searchRect.width / 2;
      const targetX = (searchCenter + liveRect.left) / 2;
      const slotCenter = slotRect.left + slotRect.width / 2;
      setShiftX(Math.round(targetX - slotCenter));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div ref={slotRef} className="flex min-w-0 flex-1 items-center justify-center px-1 sm:px-2">
      <div style={{ transform: shiftX ? `translateX(${shiftX}px)` : undefined }}>
        <KstClock />
      </div>
    </div>
  );
}

export function HeaderRightCluster() {
  return (
    <div
      data-header-right
      className="ml-auto flex min-w-[17rem] shrink-0 items-center overflow-visible sm:min-w-[22rem] md:min-w-[26rem]"
    >
      <HeaderSearch />
      <HeaderClockSlot />
      <div className="flex shrink-0 items-center gap-2.5">
        <LiveBadge />
        <ThemeToggle />
      </div>
    </div>
  );
}
