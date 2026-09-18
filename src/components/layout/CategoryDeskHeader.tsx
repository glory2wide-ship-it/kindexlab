"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { getPostChannel, resolveChannelSection } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

/**
 * Category board hero headcopy — mobile + desktop, above the ticker.
 * Section tabs live in the root layout sticky bars.
 *
 * Only the board (실시간 랭킹) section owns an H1 here. Briefing / archive /
 * about pages render their own page-level H1 — emitting a second (even
 * sr-only) H1 trips Naver Search Advisor “H1 2개 이상”.
 */
export function CategoryDeskHeader({ channel }: { channel: PostChannel }) {
  const meta = getPostChannel(channel);
  const section = resolveChannelSection(useSelectedLayoutSegment());
  if (section !== "board") return null;

  const title = meta.indexTitleDesktop ?? meta.indexTitle;
  const description = meta.descriptionDesktop ?? meta.description;

  return (
    <header className="space-y-1.5 font-gothic md:space-y-[6.12px]">
      <h1 className="whitespace-nowrap text-[clamp(16.38px,4.788vw,22.68px)] font-semibold leading-[0.8] tracking-tighter md:whitespace-normal md:text-3xl md:leading-[1.2375] md:tracking-tight">
        {title}
      </h1>
      <p className="max-w-3xl text-[11.97px] leading-[18.24px] text-soft md:text-[16.8px] md:leading-[25.92px]">
        {description}
      </p>
    </header>
  );
}
