"use client";

import { usePathname } from "next/navigation";
import { CategorySubNav } from "@/components/layout/CategorySubNav";
import { useActiveChannelOverride } from "@/components/providers/ActiveChannelProvider";
import { resolveChannelFromPath } from "@/lib/posts/resolve-channel-from-path";

/**
 * Desktop sticky 실시간 랭킹 / 일일브리핑 / 아카이브 / 소개 rail.
 * Mobile uses the same nav inside GlobalStickyMobileCategoryBar.
 */
export function GlobalDesktopCategorySectionBar() {
  const pathname = usePathname() || "/";
  const override = useActiveChannelOverride();
  const channel = override ?? resolveChannelFromPath(pathname);

  if (!channel) return null;

  return (
    <div
      className="sticky top-14 z-30 border-b border-line bg-board/95 backdrop-blur-md max-md:hidden"
      data-sticky-desktop-category-sections
    >
      <div className="mx-auto max-w-7xl px-4">
        <CategorySubNav channel={channel} />
      </div>
    </div>
  );
}
