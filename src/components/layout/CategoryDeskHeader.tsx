"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { getPostChannel, resolveChannelSection } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Category board hero.
 * Section tabs (실시간 랭킹 / 일일브리핑 / …) live in the root layout on every
 * screen — mobile via GlobalStickyMobileCategoryBar, desktop via
 * GlobalDesktopCategorySectionBar. This header only paints the board H1.
 */
export function CategoryDeskHeader({ channel }: { channel: PostChannel }) {
  const meta = getPostChannel(channel);
  const section = resolveChannelSection(useSelectedLayoutSegment());
  const desktopTitle = meta.indexTitleDesktop ?? meta.indexTitle;
  const desktopDescription = meta.descriptionDesktop ?? meta.description;
  const showDesktopBoardCopy = section === "board";

  return (
    <>
      {/* Mobile: title is announced via sr-only; visible pills live in the sticky bar. */}
      <header className="font-gothic md:hidden">
        <h1 className="sr-only">{meta.indexTitle}</h1>
      </header>

      {showDesktopBoardCopy ? (
        <header className="hidden space-y-2 font-gothic md:block">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{desktopTitle}</h1>
          <p className="max-w-3xl text-[16.8px] leading-[28.8px] text-muted">
            {desktopDescription}
          </p>
        </header>
      ) : null}
    </>
  );
}
