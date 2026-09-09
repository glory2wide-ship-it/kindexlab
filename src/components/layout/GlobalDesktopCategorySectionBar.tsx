"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { CategorySubNav } from "@/components/layout/CategorySubNav";
import { useActiveChannelOverride } from "@/components/providers/ActiveChannelProvider";
import {
  isSiteSectionPath,
  resolveChannelFromPath,
} from "@/lib/posts/resolve-channel-from-path";

const SectionTabSearch = dynamic(
  () => import("@/components/layout/HeaderSearch").then((mod) => mod.HeaderSearch),
  {
    ssr: false,
    loading: () => (
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-panel text-muted md:h-9 md:w-9"
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

/**
 * Desktop sticky section rail + search (right of 소개).
 * Tabs on landing/channel screens; search on every desktop screen.
 */
export function GlobalDesktopCategorySectionBar() {
  const pathname = usePathname() || "/";
  const override = useActiveChannelOverride();
  const channel = override ?? resolveChannelFromPath(pathname);
  const showSections = Boolean(channel) || isSiteSectionPath(pathname);

  return (
    <div
      className="sticky top-14 z-30 border-b border-line bg-board/95 backdrop-blur-md max-md:hidden"
      data-sticky-desktop-category-sections
    >
      <div className="mx-auto max-w-[72rem] px-4">
        {showSections ? (
          <CategorySubNav channel={channel} searchInputId="section-tab-search-desktop" />
        ) : (
          <div className="flex items-center justify-end py-2">
            <SectionTabSearch inputId="section-tab-search-desktop" />
          </div>
        )}
      </div>
    </div>
  );
}
