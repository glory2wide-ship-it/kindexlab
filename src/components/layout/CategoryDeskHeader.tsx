"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { getPostChannel, resolveChannelSection } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Category board hero headcopy — mobile + desktop, above the ticker.
 * Section tabs live in the root layout sticky bars.
 */
export function CategoryDeskHeader({ channel }: { channel: PostChannel }) {
  const meta = getPostChannel(channel);
  const section = resolveChannelSection(useSelectedLayoutSegment());
  const title = meta.indexTitleDesktop ?? meta.indexTitle;
  const description = meta.descriptionDesktop ?? meta.description;
  if (section !== "board") {
    return <h1 className="sr-only">{meta.indexTitle}</h1>;
  }

  return (
    <header className="space-y-1.5 font-gothic md:space-y-2">
      <h1 className="text-[21px] font-semibold leading-snug tracking-tight md:text-3xl">{title}</h1>
      <p className="max-w-3xl text-[14px] leading-6 text-muted md:text-[16.8px] md:leading-[28.8px]">
        {description}
      </p>
    </header>
  );
}
