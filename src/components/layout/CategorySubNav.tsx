"use client";

import Link from "next/link";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";
import {
  CHANNEL_SECTIONS,
  channelSectionHref,
  getPostChannel,
  resolveChannelSection,
  type ChannelSectionId,
} from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

function sectionFromPathname(pathname: string, channel: PostChannel): ChannelSectionId {
  const base = `/${channel}`;
  if (pathname === base || pathname === `${base}/`) return "board";
  if (!pathname.startsWith(`${base}/`)) return "board";
  const rest = pathname.slice(base.length + 1).split("/")[0] ?? "";
  return resolveChannelSection(rest || null);
}

export function CategorySubNav({
  channel,
  embedded = false,
}: {
  channel: PostChannel;
  /** When true, render only the pill row (mobile, under H1). */
  embedded?: boolean;
}) {
  const pathname = usePathname() || "/";
  const segment = useSelectedLayoutSegment();
  const meta = getPostChannel(channel);
  const router = useRouter();

  const active: ChannelSectionId =
    pathname === `/${channel}` || pathname.startsWith(`/${channel}/`)
      ? sectionFromPathname(pathname, channel)
      : resolveChannelSection(segment);

  const nav = (
    <nav
      className={`category-sub-nav flex gap-1 overflow-x-auto text-sm ${embedded ? "ml-0" : ""}`}
      aria-label={`${meta.label} 서브 메뉴`}
    >
      {CHANNEL_SECTIONS.map((item) => {
        const href = channelSectionHref(channel, item.id);
        const isActive = item.id === active;
        return (
          <Link
            key={item.id}
            href={href}
            prefetch={false}
            onPointerEnter={() => {
              if (!isActive) router.prefetch(href);
            }}
            title={item.description}
            className={
              isActive
                ? "shrink-0 rounded-full bg-accent px-3 py-1.5 text-[12.6px] font-medium text-black md:text-sm"
                : "shrink-0 rounded-full px-3 py-1.5 text-[12.6px] text-muted hover:bg-panel hover:text-ink md:text-sm"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  if (embedded) {
    return nav;
  }

  return (
    <div className="category-sub-nav-bar flex flex-wrap items-center gap-3 py-2">
      <DeskEyebrow variant="subnav" className="category-sub-nav-eyebrow shrink-0">
        {meta.eyebrow}
      </DeskEyebrow>
      {nav}
    </div>
  );
}
