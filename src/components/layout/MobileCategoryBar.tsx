"use client";

import Link from "next/link";
import { CHANNEL_SHORT_LABEL, POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

const CHIP_H = 31;
/** 12.1px × 1.1 */
const CHIP_TEXT = "13.31px";

/**
 * Centered category chips (전체 first). Search lives on the section-tab row.
 * Mobile-only.
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
        </nav>
      </div>
    </div>
  );
}
