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
    <header className="space-y-1.5 font-gothic md:space-y-[6.12px]">
      <h1 className="whitespace-nowrap text-[clamp(18.018px,5.2668vw,24.948px)] font-semibold leading-[0.8] tracking-tighter md:whitespace-normal md:text-[2.0625rem] md:leading-[1.2375] md:tracking-tight">
        {title}
      </h1>
      <p className="max-w-3xl text-[11.97px] leading-[18.24px] text-soft md:text-[16.8px] md:leading-[25.92px]">
        {description}
      </p>
    </header>
  );
}
