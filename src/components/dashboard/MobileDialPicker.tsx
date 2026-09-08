"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DialOption<T extends string> = { id: T; label: string };

/**
 * Horizontal snap dial: the item nearest the center is selected.
 * Mobile heatmap filter chrome only.
 */
export function MobileDialPicker<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: DialOption<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const ignoreScrollRef = useRef(false);
  const frameRef = useRef(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateEdges = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const { scrollLeft, scrollWidth, clientWidth } = scroller;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  const scrollToValue = useCallback(
    (id: T, behavior: ScrollBehavior = "smooth") => {
      const scroller = scrollerRef.current;
      const el = itemRefs.current.get(id);
      if (!scroller || !el) return;
      ignoreScrollRef.current = true;
      const left = el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2;
      scroller.scrollTo({ left: Math.max(0, left), behavior });
      window.setTimeout(() => {
        ignoreScrollRef.current = false;
        updateEdges();
      }, behavior === "auto" ? 50 : 280);
    },
    [updateEdges],
  );

  useEffect(() => {
    scrollToValue(value, "auto");
  }, [value, options, scrollToValue]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const pickNearest = () => {
      if (ignoreScrollRef.current) return;
      const center = scroller.scrollLeft + scroller.clientWidth / 2;
      let bestId = value;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const opt of options) {
        const el = itemRefs.current.get(opt.id);
        if (!el) continue;
        const mid = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(mid - center);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = opt.id;
        }
      }
      if (bestId !== value) onChange(bestId);
      else scrollToValue(bestId, "smooth");
      updateEdges();
    };

    const onScroll = () => {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(() => {
        updateEdges();
      });
    };

    const onScrollEnd = () => pickNearest();

    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("scrollend", onScrollEnd);
    let settleTimer = 0;
    const onScrollFallback = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(pickNearest, 120);
    };
    scroller.addEventListener("scroll", onScrollFallback, { passive: true });
    updateEdges();

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("scrollend", onScrollEnd);
      scroller.removeEventListener("scroll", onScrollFallback);
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(frameRef.current);
    };
  }, [onChange, options, scrollToValue, updateEdges, value]);

  return (
    <div
      className="relative min-w-0 flex-1 overflow-hidden rounded-md border border-line bg-board"
      style={{ height: 28 }}
      aria-label={ariaLabel}
    >
      <div
        ref={scrollerRef}
        className="flex h-full snap-x snap-mandatory items-center gap-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          scrollPaddingInline: "32%",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <span className="w-[32%] shrink-0" aria-hidden />
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              ref={(node) => {
                if (node) itemRefs.current.set(opt.id, node);
                else itemRefs.current.delete(opt.id);
              }}
              onClick={() => {
                onChange(opt.id);
                scrollToValue(opt.id, "smooth");
              }}
              className={`snap-center shrink-0 px-2 text-center text-[11px] font-medium leading-none whitespace-nowrap ${
                active ? "text-ink" : "text-muted"
              }`}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
        <span className="w-[32%] shrink-0" aria-hidden />
      </div>
      {/* Center selection face — fill only, no border */}
      <div
        className="pointer-events-none absolute inset-y-0.5 left-1/2 w-[38%] -translate-x-1/2 rounded bg-accent/25"
        aria-hidden
      />
      {/* Edge fades + larger swipe chevrons */}
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-board via-board/90 to-transparent transition-opacity ${
          canScrollLeft ? "opacity-100" : "opacity-50"
        }`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-board via-board/90 to-transparent transition-opacity ${
          canScrollRight ? "opacity-100" : "opacity-50"
        }`}
        aria-hidden
      />
      <span
        className={`pointer-events-none absolute top-1/2 left-0 flex h-[22px] w-[22px] -translate-y-1/2 items-center justify-center rounded-full border border-line bg-accent text-[16px] font-bold leading-none text-black shadow transition-opacity ${
          canScrollLeft ? "opacity-100" : "opacity-40"
        }`}
        aria-hidden
      >
        ‹
      </span>
      <span
        className={`pointer-events-none absolute top-1/2 right-0 flex h-[22px] w-[22px] -translate-y-1/2 items-center justify-center rounded-full border border-line bg-accent text-[16px] font-bold leading-none text-black shadow transition-opacity ${
          canScrollRight ? "opacity-100" : "opacity-40"
        }`}
        aria-hidden
      >
        ›
      </span>
    </div>
  );
}
