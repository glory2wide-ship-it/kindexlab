"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";
import {
  CHANNEL_SECTIONS,
  channelSectionHref,
  getPostChannel,
  resolveChannelSection,
} from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

export function CategorySubNav({ channel }: { channel: PostChannel }) {
  const segment = useSelectedLayoutSegment();
  const active = resolveChannelSection(segment);
  const meta = getPostChannel(channel);
  const router = useRouter();

  useEffect(() => {
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback.bind(window)
      : (cb: IdleRequestCallback) =>
          window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline), 200);
    const cancel = window.cancelIdleCallback
      ? window.cancelIdleCallback.bind(window)
      : window.clearTimeout.bind(window);

    const id = idle(() => {
      for (const item of CHANNEL_SECTIONS) {
        if (item.id === active) continue;
        router.prefetch(channelSectionHref(channel, item.id));
      }
    });
    return () => cancel(id);
  }, [active, channel, router]);

  return (
    <div className="sticky top-14 z-30 -mx-4 border-b border-line bg-board/95 px-4 backdrop-blur-md">
      <div className="category-sub-nav-bar mx-auto max-w-7xl py-2">
        <DeskEyebrow variant="subnav" className="category-sub-nav-eyebrow shrink-0">
          {meta.eyebrow}
        </DeskEyebrow>
        <nav className="category-sub-nav flex gap-1 overflow-x-auto text-sm" aria-label={`${meta.label} 서브 메뉴`}>
          {CHANNEL_SECTIONS.map((item) => {
            const href = channelSectionHref(channel, item.id);
            const isActive = item.id === active;
            return (
              <Link
                key={item.id}
                href={href}
                prefetch
                title={item.description}
                className={
                  isActive
                    ? "shrink-0 rounded-full bg-accent px-3 py-1.5 font-medium text-black"
                    : "shrink-0 rounded-full px-3 py-1.5 text-muted hover:bg-panel hover:text-ink"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
