import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelDeskWithBriefing } from "@/components/dashboard/ChannelDeskWithBriefing";
import { loadChannelPageData } from "@/lib/boards/channel-page-data";
import { getPostChannel, isPostChannel, LIVE_INDEX_LABEL } from "@/lib/posts/channels";

/** ISR: matches the 3-minute live board refresh cadence. */
export const revalidate = 180;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isPostChannel(category)) return { title: LIVE_INDEX_LABEL };
  const meta = getPostChannel(category);
  return {
    title: `${meta.label} ${LIVE_INDEX_LABEL}`,
    description: `${meta.indexTitle}와 종합 브리핑, Update 키워드를 한 페이지에서 봅니다. ${meta.description}`,
    alternates: { canonical: meta.href },
  };
}

export default async function CategoryBoardPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isPostChannel(category)) notFound();

  const { boards, liveMarket, main, dives } = await loadChannelPageData(category);

  return (
    <ChannelDeskWithBriefing
      channel={category}
      boards={boards}
      liveMarket={liveMarket}
      main={main}
      dives={dives}
      titleLevel={2}
    />
  );
}
