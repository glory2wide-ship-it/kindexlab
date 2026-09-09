"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { CategorySubNav } from "@/components/layout/CategorySubNav";
import { MobileCategoryBar } from "@/components/layout/MobileCategoryBar";
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
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-panel text-ink"
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
 * Site-wide mobile sticky stack under SiteHeader:
 * 1) 전체/엔터/… category chips
 * 2) section tabs + search (search always; tabs on landing/channel screens)
 */
export function GlobalStickyMobileCategoryBar() {
  const pathname = usePathname() || "/";
  const override = useActiveChannelOverride();
  const channel = override ?? resolveChannelFromPath(pathname);
  const showSections = Boolean(channel) || isSiteSectionPath(pathname);

  return (
    <div
      className="sticky top-14 z-30 border-b border-line bg-board/95 backdrop-blur-md md:hidden"
      data-sticky-mobile-categories
    >
      <div className="mx-auto max-w-[72rem] space-y-1.5 px-4 py-1.5">
        <MobileCategoryBar activeId={channel} />
        {showSections ? (
          <div data-sticky-mobile-category-sections>
            <CategorySubNav
              channel={channel}
              embedded
              searchInputId="section-tab-search-mobile"
            />
          </div>
        ) : (
          <div
            className="flex justify-center"
            data-sticky-mobile-category-sections
          >
            <SectionTabSearch inputId="section-tab-search-mobile" />
          </div>
        )}
      </div>
    </div>
  );
}
