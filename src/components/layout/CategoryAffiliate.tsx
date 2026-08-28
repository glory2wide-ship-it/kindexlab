import { AffiliateLinkRail } from "@/components/affiliate/AffiliateLinkRail";
import { getRankings } from "@/lib/api";
import { CHANNEL_ENTITY_TYPES, getPostChannel } from "@/lib/posts/channels";
import { listPostsByChannel } from "@/lib/posts/store";
import { heatForTimeframe } from "@/lib/timeframes";
import type { PostChannel } from "@/lib/posts/types";

export async function CategoryAffiliate({ channel }: { channel: PostChannel }) {
  const meta = getPostChannel(channel);
  const [posts, market] = await Promise.all([listPostsByChannel(channel), getRankings()]);
  const types = CHANNEL_ENTITY_TYPES[channel];
  const lead = [...market.items]
    .filter((item) => types.includes(item.type))
    .sort((a, b) => heatForTimeframe(b, "5m") - heatForTimeframe(a, "5m"))[0];
  const keyword = posts[0]?.focusKeyword || lead?.name;

  return (
    <AffiliateLinkRail
      channel={channel}
      keyword={keyword}
      entityName={lead?.name || meta.label}
      products={lead?.products ?? []}
    />
  );
}
