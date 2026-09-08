"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { CHANNEL_SHORT_LABEL, POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

const CHIP_H = 31;
/** 12.1px × 1.1 */
const CHIP_TEXT = "13.31px";

const MobileCategorySearch = dynamic(
  () => import("@/components/layout/HeaderSearch").then((mod) => mod.HeaderSearch),
  {
    ssr: false,
    loading: () => (
      <span
        className="inline-flex min-w-0 flex-1 items-center justify-center rounded-md border border-line bg-panel text-ink"
        style={{ height: CHIP_H }}
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
 * Centered category chips (전체 first) + search chip of equal size. Mobile-only.
 */
export function MobileCategoryBar({
  activeId,
  className = "",
}: {
  activeId?: PostChannel;
  className?: string;
}) {
  const chipClass =
    "inline-flex min-w-0 flex-1 items-center justify-center rounded-md border px-0.5 text-center font-medium leading-none whitespace-nowrap";
  const allActive = !activeId;

  return (
    <div className={`flex justify-center md:hidden ${className}`}>
      <div className="flex w-full max-w-md items-stretch justify-center gap-1">
        <nav className="flex min-w-0 flex-1 gap-1" aria-label="카테고리">
          <Link
            href="/"
            prefetch={false}
            className={`${chipClass} ${
              allActive
                ? "border-accent bg-accent text-black"
                : "border-line bg-panel text-ink hover:border-accent hover:text-accent"
            }`}
            style={{ height: CHIP_H, fontSize: CHIP_TEXT }}
          >
            전체
          </Link>
          {POST_CHANNELS.map((item) => {
            const active = activeId === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={false}
                className={`${chipClass} ${
                  active
                    ? "border-accent bg-accent text-black"
                    : "border-line bg-panel text-ink hover:border-accent hover:text-accent"
                }`}
                style={{ height: CHIP_H, fontSize: CHIP_TEXT }}
              >
                {CHANNEL_SHORT_LABEL[item.id] ?? item.label}
              </Link>
            );
          })}
          {/* Same flex-1 slot as category chips so width/height match */}
          <div
            className="flex min-w-0 flex-1 items-stretch [&_form]:flex [&_form]:h-full [&_form]:w-full [&_form]:min-w-0 [&_button[aria-label=검색]]:h-full [&_button[aria-label=검색]]:w-full [&_button[aria-label=검색]]:min-w-0 [&_button[aria-label=검색]]:rounded-md [&_button[aria-label=검색]]:border-line [&_button[aria-label=검색]]:bg-panel"
            style={{ height: CHIP_H }}
          >
            <MobileCategorySearch inputId="category-bar-search" mobileOnly />
          </div>
        </nav>
      </div>
    </div>
  );
}
