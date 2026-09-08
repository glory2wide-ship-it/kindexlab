"use client";

import { useCallback, useEffect, useRef } from "react";

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

  const scrollToValue = useCallback((id: T, behavior: ScrollBehavior = "smooth") => {
    const scroller = scrollerRef.current;
    const el = itemRefs.current.get(id);
    if (!scroller || !el) return;
    ignoreScrollRef.current = true;
    const left = el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior });
    window.setTimeout(() => {
      ignoreScrollRef.current = false;
    }, behavior === "auto" ? 50 : 280);
  }, []);

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
    };

    const onScroll = () => {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(() => {
        /* wait for snap settle via scrollend when available */
      });
    };

    const onScrollEnd = () => pickNearest();

    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("scrollend", onScrollEnd);
    // Fallback when scrollend is missing
    let settleTimer = 0;
    const onScrollFallback = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(pickNearest, 120);
    };
    scroller.addEventListener("scroll", onScrollFallback, { passive: true });

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("scrollend", onScrollEnd);
      scroller.removeEventListener("scroll", onScrollFallback);
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(frameRef.current);
    };
  }, [onChange, options, scrollToValue, value]);

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
              className={`snap-center shrink-0 px-2 text-center text-[10px] font-medium leading-none whitespace-nowrap ${
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
    </div>
  );
}
