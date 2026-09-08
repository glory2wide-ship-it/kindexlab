"use client";

import { usePathname } from "next/navigation";
import { CategorySubNav } from "@/components/layout/CategorySubNav";
import { useActiveChannelOverride } from "@/components/providers/ActiveChannelProvider";
import { getBoard } from "@/lib/boards/registry";
import { isPostChannel } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import { decodeRouteSlug } from "@/lib/slugs";

function channelFromPath(pathname: string): PostChannel | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const head = parts[0];
  if (!head) return undefined;
  if (isPostChannel(head)) return head;
  if (head === "approval") return "politics";
  if (head === "board" && parts[1]) {
    return getBoard(decodeRouteSlug(parts[1]))?.channel;
  }
  if (head === "ranking" && parts[1]) {
    const decoded = decodeRouteSlug(parts[1]);
    const boardSlug = decoded.includes("--") ? decoded.split("--")[0]! : decoded;
    return getBoard(boardSlug)?.channel;
  }
  return undefined;
}

/**
 * Desktop-only sticky 실시간 랭킹 / 일일브리핑 / 아카이브 / 소개 rail.
 * Lives in the root layout so ranking detail, briefing articles, and board
 * pages keep the same tab slot. Hidden on mobile (`max-md:hidden`).
 */
export function GlobalDesktopCategorySectionBar() {
  const pathname = usePathname() || "/";
  const override = useActiveChannelOverride();
  const channel = override ?? channelFromPath(pathname);

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
