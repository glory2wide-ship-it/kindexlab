"use client";

import { usePathname } from "next/navigation";
import { CategorySubNav } from "@/components/layout/CategorySubNav";
import { MobileCategoryBar } from "@/components/layout/MobileCategoryBar";
import { useActiveChannelOverride } from "@/components/providers/ActiveChannelProvider";
import {
  isSiteSectionPath,
  resolveChannelFromPath,
} from "@/lib/posts/resolve-channel-from-path";

/**
 * Site-wide mobile sticky stack under SiteHeader:
 * 1) 전체/엔터/… category chips
 * 2) 실시간 랭킹 / 일일브리핑 / 아카이브 / 소개 (landing + channel screens)
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
      <div className="mx-auto max-w-7xl space-y-1.5 px-4 py-1.5">
        <MobileCategoryBar activeId={channel} />
        {showSections ? (
          <div data-sticky-mobile-category-sections>
            <CategorySubNav channel={channel} embedded />
          </div>
        ) : null}
      </div>
    </div>
  );
}
