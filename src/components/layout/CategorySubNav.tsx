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

/** Match MobileCategoryBar chip boxes. Mobile type is prior 14.08px −5%. Desktop −7% from 16.09px. */
const CHIP_H = 31;
const CHIP_TEXT_MOBILE = "13.38px";
const CHIP_TEXT_DESKTOP = "14.96px";

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
  /** When true, render only the chip row (mobile sticky stack). */
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

  const chipBase =
    "box-border inline-flex items-center justify-center rounded-md border bg-clip-padding text-center leading-none tracking-normal whitespace-nowrap";

  const nav = (
    <nav
      className={
        embedded
          ? "category-sub-nav flex min-w-0 flex-1 items-stretch gap-1 overflow-x-hidden"
          : "category-sub-nav flex min-w-0 shrink-0 items-stretch gap-2 overflow-x-auto"
      }
      aria-label={meta ? `${meta.label} 서브 메뉴` : "전체 서브 메뉴"}
    >
      {CHANNEL_SECTIONS.map((item) => {
        const href = channel ? channelSectionHref(channel, item.id) : siteSectionHref(item.id);
        const isActive = item.id === active;
        // Mobile: short tabs hug content; briefing/magazine share space with matching inset.
        const mobileWidthClass =
          item.id === "about" || item.id === "board"
            ? "shrink-0 px-2"
            : item.id === "briefing" || item.id === "archive"
              ? "min-w-0 flex-[1.2] px-2"
              : "min-w-0 flex-1 px-1.5";
        return (
          <Link
            key={item.id}
            href={href}
            prefetch={false}
            onPointerEnter={() => {
              if (!isActive) router.prefetch(href);
            }}
            title={item.description}
            className={`${chipBase} ${
              embedded ? mobileWidthClass : "shrink-0 px-2.5 md:px-3"
            } ${
              isActive
                ? "border-accent bg-accent font-normal text-black"
                : "border-line bg-board font-normal text-ink hover:border-accent hover:text-accent"
            }`}
            style={{
              height: CHIP_H,
              fontSize: embedded ? CHIP_TEXT_MOBILE : CHIP_TEXT_DESKTOP,
            }}
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
      <div className="flex w-full min-w-0 items-center justify-start gap-1 overflow-x-hidden pr-px">
        {nav}
        {search}
      </div>
    );
  }

  // Desktop: English desk label on the left; section chips + search centered.
  return (
    <div className="category-sub-nav-bar relative flex w-full flex-wrap items-center justify-center gap-3 py-2">
      <DeskEyebrow
        variant="subnav"
        className="category-sub-nav-eyebrow absolute left-0 top-1/2 hidden -translate-y-1/2 shrink-0 md:block"
      >
        {meta?.eyebrow ?? "ALL DESKS"}
      </DeskEyebrow>
      <div className="flex min-w-0 shrink-0 items-center justify-center gap-2">
        {nav}
        {search}
      </div>
    </div>
  );
}
