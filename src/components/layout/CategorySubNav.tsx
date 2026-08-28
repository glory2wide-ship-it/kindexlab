"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
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

  return (
    <div className="sticky top-14 z-30 -mx-4 border-b border-line bg-board/95 px-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 py-2 md:flex-row md:items-center md:justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">{meta.eyebrow}</p>
        <nav className="flex gap-1 overflow-x-auto text-sm" aria-label={`${meta.label} 서브 메뉴`}>
          {CHANNEL_SECTIONS.map((item) => {
            const href = channelSectionHref(channel, item.id);
            const isActive = item.id === active;
            return (
              <Link
                key={item.id}
                href={href}
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
