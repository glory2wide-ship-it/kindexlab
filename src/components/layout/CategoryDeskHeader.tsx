"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { CategorySubNav } from "@/components/layout/CategorySubNav";
import { getPostChannel, resolveChannelSection } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Category board hero.
 * Mobile: submenu pills under the sticky category chips.
 * Desktop: board H1/description only on 실시간 랭킹. Section tabs live in the
 * root GlobalDesktopCategorySectionBar on every desktop screen.
 */
export function CategoryDeskHeader({ channel }: { channel: PostChannel }) {
  const meta = getPostChannel(channel);
  const section = resolveChannelSection(useSelectedLayoutSegment());
  const desktopTitle = meta.indexTitleDesktop ?? meta.indexTitle;
  const desktopDescription = meta.descriptionDesktop ?? meta.description;
  const showDesktopBoardCopy = section === "board";

  return (
    <>
      {/* Mobile: always expose section pills; board title stays sr-only. */}
      <header className="space-y-2 font-gothic md:hidden">
        <h1 className="sr-only">{meta.indexTitle}</h1>
        <CategorySubNav channel={channel} embedded />
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
