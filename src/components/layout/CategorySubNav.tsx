"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import { DeskEyebrow } from "@/components/ui/DeskEyebrow";
import {
  CHANNEL_SECTIONS,
  channelSectionHref,
  getPostChannel,
  resolveChannelSection,
  resolveSiteSection,
  siteSectionHref,
  type ChannelSectionId,
} from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

const SectionTabSearch = dynamic(
  () => import("@/components/layout/HeaderSearch").then((mod) => mod.HeaderSearch),
  {
    ssr: false,
    loading: () => (
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-panel text-ink md:h-9 md:w-9"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
      </span>
    ),
  },
);

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
  searchInputId = "section-tab-search",
  showSearch = true,
}: {
  /** When omitted, links target the landing (전체) site sections. */
  channel?: PostChannel;
  /** When true, render only the pill row (mobile sticky stack). */
  embedded?: boolean;
  searchInputId?: string;
  showSearch?: boolean;
}) {
  const pathname = usePathname() || "/";
  const segment = useSelectedLayoutSegment();
  const router = useRouter();
  const meta = channel ? getPostChannel(channel) : null;

  const active: ChannelSectionId = channel
    ? pathname === `/${channel}` || pathname.startsWith(`/${channel}/`)
      ? sectionFromPathname(pathname, channel)
      : resolveChannelSection(segment)
    : resolveSiteSection(pathname);

  const nav = (
    <nav
      className="category-sub-nav flex min-w-0 shrink-0 gap-1 overflow-x-auto text-sm"
      aria-label={meta ? `${meta.label} 서브 메뉴` : "전체 서브 메뉴"}
    >
      {CHANNEL_SECTIONS.map((item) => {
        const href = channel ? channelSectionHref(channel, item.id) : siteSectionHref(item.id);
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
                : "shrink-0 rounded-full px-3 py-1.5 text-[12.6px] font-medium text-soft hover:bg-panel hover:text-ink md:text-sm"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const search = showSearch ? (
    <SectionTabSearch inputId={searchInputId} />
  ) : null;

  if (embedded) {
    return (
      <div className="flex min-w-0 items-center justify-center gap-1.5">
        {nav}
        {search}
      </div>
    );
  }

  return (
    <div className="category-sub-nav-bar flex w-full flex-wrap items-center justify-between gap-3 py-2">
      <DeskEyebrow variant="subnav" className="category-sub-nav-eyebrow shrink-0">
        {meta?.eyebrow ?? "ALL DESKS"}
      </DeskEyebrow>
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
        {nav}
        {search}
      </div>
    </div>
  );
}
