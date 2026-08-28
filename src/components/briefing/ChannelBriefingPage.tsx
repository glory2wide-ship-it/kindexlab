import { ChannelBriefingLayout } from "@/components/briefing/ChannelBriefingLayout";
import { getChannelBriefingEdition, splitChannelEdition } from "@/lib/api";
import type { PostChannel } from "@/lib/posts/types";

/** Shared 종합 히어로 + 하부 메뉴 그리드 page body. Entertainment, politics, economy, and culture all bind here. */
export async function ChannelBriefingPage({
  channel,
  heading,
  titleLevel,
}: {
  channel: PostChannel;
  heading?: string;
  titleLevel?: 1 | 2;
}) {
  const edition = await getChannelBriefingEdition(channel);
  const { main, dives } = splitChannelEdition(edition);
  return (
    <ChannelBriefingLayout
      channel={channel}
      main={main}
      dives={dives}
      heading={heading}
      titleLevel={titleLevel}
    />
  );
}
