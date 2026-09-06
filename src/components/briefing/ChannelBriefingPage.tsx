import { ChannelBriefingLayout } from "@/components/briefing/ChannelBriefingLayout";
import { getChannelBriefingEdition, splitChannelEdition } from "@/lib/api";
import { slimBriefingForCard, slimBriefingsForCards } from "@/lib/briefing/card-dto";
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
  let main;
  let dives: Awaited<ReturnType<typeof splitChannelEdition>>["dives"] = [];
  try {
    const edition = await getChannelBriefingEdition(channel);
    const split = splitChannelEdition(edition);
    main = split.main ? slimBriefingForCard(split.main) : undefined;
    dives = slimBriefingsForCards(split.dives);
  } catch {
    main = undefined;
    dives = [];
  }
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
