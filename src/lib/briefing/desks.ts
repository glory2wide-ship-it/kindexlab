import { TYPE_ORDER } from "@/lib/categories";
import { POLITICS_INDEX_META } from "@/lib/politics/types";
import { CHANNEL_ENTITY_TYPES, getPostChannel } from "@/lib/posts/channels";
import type { CategoryId, EntityType } from "@/lib/types";
import type { PostChannel } from "@/lib/posts/types";

export interface ChannelBriefingDesk {
  id: string;
  label: string;
  category: CategoryId;
  indexId?: string;
}

const ENTERTAINMENT_DESK_LABEL: Record<string, string> = {
  kpop: "K-POP 아이돌",
  celebrity: "셀럽",
  tv_show: "방송",
  influencer: "인플루언서",
  music_chart: "실시간 음원차트",
  tv_rating: "실시간 시청률 순위",
  webtoon: "실시간 웹툰",
  shorts: "숏폼/SNS",
  mobile_game: "모바일게임",
  pc_game: "PC게임",
  console_game: "콘솔게임",
};

const POLITICS_DESK_ORDER = [
  "pol-headline",
  "pol-approval",
  "pol-party",
  "pol-politician",
  "pol-pundit",
  "pol-influencer",
  "pol-ratings",
  "pol-search",
  "pol-policy",
  "pol-subsidy",
] as const;

const POLITICS_DESK_LABEL: Record<(typeof POLITICS_DESK_ORDER)[number], string> = {
  "pol-headline": "헤드라인지수",
  "pol-approval": "대통령 지수",
  "pol-party": "정당 지수",
  "pol-politician": "정치인 지수",
  "pol-pundit": "평론가 지수",
  "pol-influencer": "정치 SNS 지수",
  "pol-ratings": "정치방송시청지수",
  "pol-search": "정치 검색어 지수",
  "pol-policy": "지자체 정책지수",
  "pol-subsidy": "지원금 지수",
};

function desksFromTypes(types: EntityType[]): ChannelBriefingDesk[] {
  return types.map((type) => ({
    id: type,
    label: ENTERTAINMENT_DESK_LABEL[type] ?? type,
    category: type,
    indexId: type,
  }));
}

/** Lower-menu deep-dive desks for a top-level channel. Economy/culture inherit the same rule automatically. */
export function desksForChannel(channel: PostChannel): ChannelBriefingDesk[] {
  if (channel === "entertainment") {
    return desksFromTypes([...TYPE_ORDER]);
  }
  if (channel === "politics") {
    return POLITICS_DESK_ORDER.map((id) => {
      const meta = POLITICS_INDEX_META.find((item) => item.id === id);
      return {
        id,
        label: POLITICS_DESK_LABEL[id],
        category: (meta?.type ?? "politician_support") as CategoryId,
        indexId: id,
      };
    });
  }
  return desksFromTypes(CHANNEL_ENTITY_TYPES[channel]);
}

export function channelMainLabel(channel: PostChannel): string {
  return `${getPostChannel(channel).label} 종합 브리핑`;
}

export function channelDeskTypes(channel: PostChannel): EntityType[] {
  const types = desksForChannel(channel)
    .map((desk) => desk.category)
    .filter((id): id is EntityType => id !== "all");
  return [...new Set(types)];
}

export function isPresidentialDesk(deskId?: string): boolean {
  return deskId === "pol-approval";
}
