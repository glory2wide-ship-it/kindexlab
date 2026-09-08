"use client";

import { usePathname } from "next/navigation";
import { MobileCategoryBar } from "@/components/layout/MobileCategoryBar";
import { useActiveChannelOverride } from "@/components/providers/ActiveChannelProvider";
import { isPostChannel } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

function activeChannelFromPath(pathname: string): PostChannel | undefined {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (!segment) return undefined;
  if (isPostChannel(segment)) return segment;
  if (segment === "approval") return "politics";
  return undefined;
}

/**
 * Site-wide mobile category chips under SiteHeader.
 * Lives in the root layout so every route keeps 전체/엔터/… pinned while scrolling.
 * Detail pages can override the active chip via SetActiveChannel.
 */
export function GlobalStickyMobileCategoryBar() {
  const pathname = usePathname() || "/";
  const override = useActiveChannelOverride();
  const activeId = override ?? activeChannelFromPath(pathname);

  return (
    <div
      className="sticky top-14 z-30 border-b border-line bg-board/95 backdrop-blur-md md:hidden"
      data-sticky-mobile-categories
    >
      <div className="mx-auto max-w-7xl px-4 py-1.5">
        <MobileCategoryBar activeId={activeId} />
      </div>
    </div>
  );
}
