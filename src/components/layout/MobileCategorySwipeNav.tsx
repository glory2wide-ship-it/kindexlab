"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActiveChannelOverride } from "@/components/providers/ActiveChannelProvider";
import { POST_CHANNELS } from "@/lib/posts/channels";
import { resolveChannelFromPath } from "@/lib/posts/resolve-channel-from-path";
import type { PostChannel } from "@/lib/posts/types";

/** 전체 → 채널 순. 좌 스와이프 = 다음, 우 스와이프 = 이전. */
const CATEGORY_HREFS: string[] = ["/", ...POST_CHANNELS.map((item) => item.href)];

function hrefForChannel(channel: PostChannel | undefined): string {
  if (!channel) return "/";
  return POST_CHANNELS.find((item) => item.id === channel)?.href ?? "/";
}

function indexForPath(pathname: string, override: PostChannel | null | undefined): number {
  const active = override ?? resolveChannelFromPath(pathname);
  const href = hrefForChannel(active);
  // Channel section paths (/entertainment/briefing …) still map to the channel root for swipe.
  if (pathname === "/" || pathname === "") return 0;
  const exact = CATEGORY_HREFS.indexOf(href);
  return exact >= 0 ? exact : 0;
}

const SWIPE_MIN_DX = 64;
const SWIPE_MAX_DY_RATIO = 0.75;

/**
 * Mobile-only horizontal swipe to change top-level category (전체·엔터·정치…).
 * Ignores gestures that start on inputs/scrollers or are mostly vertical.
 */
export function MobileCategorySwipeNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const override = useActiveChannelOverride();
  const startRef = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null);
  const navigatingRef = useRef(false);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (navigatingRef.current) return;
      const idx = indexForPath(pathname, override);
      const next = idx + dir;
      if (next < 0 || next >= CATEGORY_HREFS.length) return;
      const href = CATEGORY_HREFS[next]!;
      navigatingRef.current = true;
      router.push(href);
      window.setTimeout(() => {
        navigatingRef.current = false;
      }, 500);
    },
    [override, pathname, router],
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onStart = (event: TouchEvent) => {
      if (!mq.matches || event.touches.length !== 1) return;
      const touch = event.touches[0]!;
      const target = event.target;
      if (target instanceof Element) {
        if (
          target.closest(
            "input, textarea, select, [contenteditable=true], [data-no-category-swipe], .tv-lightweight-charts",
          )
        ) {
          startRef.current = null;
          return;
        }
      }
      startRef.current = { x: touch.clientX, y: touch.clientY, target };
    };
    const onEnd = (event: TouchEvent) => {
      if (!mq.matches || !startRef.current || event.changedTouches.length !== 1) {
        startRef.current = null;
        return;
      }
      const touch = event.changedTouches[0]!;
      const dx = touch.clientX - startRef.current.x;
      const dy = touch.clientY - startRef.current.y;
      startRef.current = null;
      if (Math.abs(dx) < SWIPE_MIN_DX) return;
      if (Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_DY_RATIO) return;
      // Finger moved left → next category; right → previous.
      go(dx < 0 ? 1 : -1);
    };
    const onCancel = () => {
      startRef.current = null;
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
    };
  }, [go]);

  return null;
}
