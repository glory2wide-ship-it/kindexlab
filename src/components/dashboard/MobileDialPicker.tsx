"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DialOption<T extends string> = { id: T; label: string };

function DialChevron({
  direction,
  visible,
}: {
  direction: "left" | "right";
  visible: boolean;
}) {
  return (
    <span
      className={`pointer-events-none flex h-[28px] w-[13px] shrink-0 items-center justify-center text-accent transition-opacity ${
        visible ? "opacity-100" : "opacity-35"
      }`}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[21px] w-[21px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {direction === "left" ? (
          <path d="M15 6l-6 6 6 6" />
        ) : (
          <path d="M9 6l6 6-6 6" />
        )}
      </svg>
    </span>
  );
}

/**
 * Horizontal snap dial: selected value centered, neighbors visible left/right.
 * Chevrons sit outside the label box so they never cover option text.
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
    <div className="flex min-w-0 flex-1 items-center gap-0" aria-label={ariaLabel}>
      <DialChevron direction="left" visible={canScrollLeft} />
      <div
        className="relative min-w-0 flex-1 overflow-hidden rounded-md bg-board"
        style={{ height: 28 }}
      >
        <div
          ref={scrollerRef}
          className="flex h-full snap-x snap-mandatory items-center gap-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            // Wider label lane (~15%): keep neighbors visible in side thirds.
            scrollPaddingInline: "30%",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <span className="w-[30%] shrink-0" aria-hidden />
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
                className={`snap-center shrink-0 px-1 text-center text-[11px] font-semibold leading-none whitespace-nowrap ${
                  active ? "text-ink" : "text-soft"
                }`}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
          <span className="w-[30%] shrink-0" aria-hidden />
        </div>
        {/* Center selection face — fill only, no border */}
        <div
          className="pointer-events-none absolute inset-y-0.5 left-1/2 w-[36%] -translate-x-1/2 rounded bg-accent/25"
          aria-hidden
        />
      </div>
      <DialChevron direction="right" visible={canScrollRight} />
    </div>
  );
}
