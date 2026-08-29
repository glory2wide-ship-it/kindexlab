import type { CategoryId, EntityType, RankingEntity } from "@/lib/types";
import type { GeneratedPost, PostChannel } from "@/lib/posts/types";
import { isPoliticsEntityType, POLITICS_TYPE_ORDER } from "@/lib/politics/types";

export type ChannelSectionId = "board" | "briefing" | "posts" | "archive" | "about";

/** Page heading for a channel's live index board, and the tab title it drives. */
export const LIVE_INDEX_LABEL = "실시간 지수 / LIVE INDEX";

/**
 * Two-character desk tags for the unified landing heatmap.
 *
 * A tile is often narrower than 100px, so the full 문화/여행/맛집/레져/생활 label
 * cannot ride along with the rank badge.
 */
export const CHANNEL_SHORT_LABEL: Record<PostChannel, string> = {
  entertainment: "엔터",
  politics: "정치",
  economy: "경제",
  culture: "문화",
};

export const POST_CHANNELS: {
  id: PostChannel;
  href: `/${PostChannel}`;
  label: string;
  eyebrow: string;
  /** H1 on the channel board page. Spelled out per channel rather than derived
   *  from `label`, since 엔터테인먼트 drops the 이슈 qualifier the others carry. */
  indexTitle: string;
  description: string;
}[] = [
  {
    id: "entertainment",
    href: "/entertainment",
    label: "엔터테인먼트",
    eyebrow: "K ENTERTAINMENT DESK",
    indexTitle: "엔터테인먼트 지수(INDEX)",
    description: "아이돌·방송·셀럽 이슈 키워드로 독립 매거진 칼럼을 발행합니다.",
  },
  {
    id: "politics",
    href: "/politics",
    label: "정치",
    eyebrow: "POLITICS ISSUE INDEX DESK",
    indexTitle: "정치 이슈 지수(INDEX)",
    description: "정당·정치인·지원금 이슈를 지수(INDEX) 키워드에서 골라 독립 칼럼으로 풉니다.",
  },
  {
    id: "economy",
    href: "/economy",
    label: "경제",
    eyebrow: "ECONOMY ISSUE INDEX DESK",
    indexTitle: "경제 이슈 지수(INDEX)",
    description: "환율·생활 화제 키워드를 지수(INDEX)에서 고른 뒤 독립 칼럼으로 하루 세 번 풉니다.",
  },
  {
    id: "culture",
    href: "/culture",
    label: "문화/여행/맛집/레져/생활",
    eyebrow: "CULTURE & LIVING ISSUE INDEX DESK",
    indexTitle: "문화/여행/맛집/레져/생활 이슈 지수(INDEX)",
    description:
      "공연·여행·맛집·레져·생활 이슈 키워드를 같은 매거진 규격으로 다룹니다.",
  },
];

export const CHANNEL_SECTIONS: {
  id: ChannelSectionId;
  path: string;
  label: string;
  description: string;
}[] = [
  {
    id: "board",
    path: "",
    label: LIVE_INDEX_LABEL,
    description: "실시간 수치와 5분봉 히트맵. 글 생성에는 이름만 넘깁니다.",
  },
  {
    id: "briefing",
    path: "/briefing",
    label: "일일브리핑",
    description: "키워드 기반 심층 이슈 칼럼, 마크다운 표, FAQ",
  },
  {
    id: "posts",
    path: "/posts",
    label: "이슈칼럼",
    description: "시세와 무관한 정보성 매거진 칼럼",
  },
  {
    id: "archive",
    path: "/archive",
    label: "아카이브",
    description: "지난 이슈 칼럼 목록",
  },
  {
    id: "about",
    path: "/about",
    label: "소개",
    description: "서비스 개요와 산출 방식",
  },
];

const CHANNEL_IDS = new Set<PostChannel>(POST_CHANNELS.map((item) => item.id));

export function isPostChannel(value: string | undefined): value is PostChannel {
  return Boolean(value && CHANNEL_IDS.has(value as PostChannel));
}

export function getPostChannel(id: PostChannel) {
  const found = POST_CHANNELS.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown post channel: ${id}`);
  return found;
}

export function channelHref(channel: PostChannel, slug?: string): string {
  return slug ? `/${channel}/${slug}` : `/${channel}`;
}

export function channelSectionHref(channel: PostChannel, section: ChannelSectionId = "board"): string {
  const found = CHANNEL_SECTIONS.find((item) => item.id === section);
  return `/${channel}${found?.path ?? ""}`;
}

export const CHANNEL_ENTITY_TYPES: Record<PostChannel, EntityType[]> = {
  entertainment: ["kpop", "celebrity", "tv_show", "influencer", "music_chart", "tv_rating"],
  culture: ["culture_board", "webtoon", "shorts", "mobile_game", "pc_game", "console_game"],
  economy: ["economy_board"],
  politics: [...POLITICS_TYPE_ORDER],
};

export function channelFromEntityType(type: EntityType): PostChannel {
  if (type === "economy_board") return "economy";
  if (type === "culture_board" || CHANNEL_ENTITY_TYPES.culture.includes(type)) return "culture";
  if (isPoliticsEntityType(type)) return "politics";
  return "entertainment";
}

export function channelFromLead(lead: RankingEntity, slug?: string): PostChannel {
  if (slug?.startsWith("fx-life")) return "economy";
  return channelFromEntityType(lead.type);
}

export function itemsForChannel(items: RankingEntity[], channel: PostChannel): RankingEntity[] {
  const types = CHANNEL_ENTITY_TYPES[channel];
  if (!types.length) return [];
  return items.filter((item) => types.includes(item.type));
}

export function inferPostChannel(
  post: Pick<GeneratedPost, "slug" | "title" | "excerpt" | "channel">,
): PostChannel {
  if (isPostChannel(post.channel)) return post.channel;
  if (post.slug.startsWith("fx-life")) return "economy";
  const hay = `${post.slug} ${post.title}`;
  if (/정치|국회|대선|선거|여야/.test(hay)) return "politics";
  if (/웹툰|숏폼|문화/.test(hay)) return "culture";
  return "entertainment";
}

export function briefingMatchesChannel(
  article: { category: CategoryId; title?: string; channel?: string },
  channel: PostChannel,
): boolean {
  if (article.channel) return article.channel === channel;
  if (article.category !== "all" && CHANNEL_ENTITY_TYPES[channel].includes(article.category)) {
    return true;
  }
  const hay = article.title ?? "";
  if (channel === "politics" && /정치|국회|대선|선거|여야/.test(hay)) return true;
  if (channel === "economy" && /환율|경제|물가|금리|생활/.test(hay)) return true;
  if (article.category === "all") return channel === "entertainment";
  return false;
}

export function affiliateKeyword(channel: PostChannel, fallback?: string): string {
  if (fallback) return fallback;
  switch (channel) {
    case "entertainment":
      return "아이돌 굿즈";
    case "economy":
      return "생활 가전";
    case "politics":
      return "정부 지원금";
    case "culture":
      return "웹툰 단행본";
  }
}

export function resolveChannelSection(segment: string | null): ChannelSectionId {
  if (!segment) return "board";
  if (segment === "briefing" || segment === "posts" || segment === "archive" || segment === "about") {
    return segment;
  }
  return "posts";
}
