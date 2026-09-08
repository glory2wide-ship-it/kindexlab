"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { CHANNEL_SHORT_LABEL, POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

const MobileCategorySearch = dynamic(
  () => import("@/components/layout/HeaderSearch").then((mod) => mod.HeaderSearch),
  {
    ssr: false,
    loading: () => (
      <span
        className="grid h-[25.5px] w-[25.5px] shrink-0 place-items-center rounded-md border border-line bg-panel text-ink"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
      </span>
    ),
  },
);

/**
 * Five desk chips (~80% width) + search on the right.
 * Mobile-only — desktop keeps HeaderNav / header search.
 */
export function MobileCategoryBar({
  activeId,
  className = "",
}: {
  activeId?: PostChannel;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 md:hidden ${className}`}>
      <nav className="flex min-w-0 flex-[0_0_80%] gap-1" aria-label="카테고리">
        {POST_CHANNELS.map((item) => {
          const active = activeId === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch={false}
              className={`inline-flex min-h-[25.5px] min-w-0 flex-1 items-center justify-center rounded-md border px-0.5 text-center text-[11px] font-medium leading-none whitespace-nowrap ${
                active
                  ? "border-accent bg-accent text-black"
                  : "border-line bg-panel text-ink hover:border-accent hover:text-accent"
              }`}
            >
              {CHANNEL_SHORT_LABEL[item.id] ?? item.label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto shrink-0 [&_button[aria-label=검색]]:h-[25.5px] [&_button[aria-label=검색]]:w-[25.5px] [&_button[aria-label=검색]]:rounded-md">
        <MobileCategorySearch inputId="category-bar-search" mobileOnly />
      </div>
    </div>
  );
}
