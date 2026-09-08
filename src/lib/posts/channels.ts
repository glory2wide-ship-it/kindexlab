import type { CategoryId, EntityType, RankingEntity } from "@/lib/types";
import type { GeneratedPost, PostChannel } from "@/lib/posts/types";
import { isPoliticsEntityType, POLITICS_TYPE_ORDER } from "@/lib/politics/types";

export type ChannelSectionId = "board" | "briefing" | "archive" | "about";

/** Page heading for a channel's live ranking board, and the tab title it drives. */
export const LIVE_INDEX_LABEL = "실시간 랭킹";

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
  travel: "여행",
};

export const POST_CHANNELS: {
  id: PostChannel;
  href: `/${PostChannel}`;
  label: string;
  eyebrow: string;
  /** H1 on the channel board page (desktop). Mobile hides this heading. */
  indexTitle: string;
  description: string;
  /** Optional desktop-only visible H1/subcopy; mobile keeps indexTitle (sr-only). */
  indexTitleDesktop?: string;
  descriptionDesktop?: string;
}[] = [
  {
    id: "entertainment",
    href: "/entertainment",
    label: "엔터",
    eyebrow: "ENTERTAINMENT",
    indexTitle: "엔터테인먼트",
    description:
      "K POP·트로트·가요, TV 시청률, 음원, 스타, 영화, 유튜버, 웹툰, 게임을 실시간 랭킹과 브리핑으로 읽습니다.",
    indexTitleDesktop: "K-컬처와 팬덤 화제성의 현재가, 엔터테인먼트 지수",
    descriptionDesktop:
      "음원, 영화, 방송, 웹툰까지 대중을 움직이는 실시간 데이터로 읽는 대중문화 트렌드의 흐름.",
  },
  {
    id: "politics",
    href: "/politics",
    label: "정치",
    eyebrow: "POLITICS",
    indexTitle: "정치",
    description:
      "정부 지원금, 정당·정치인 지지도, 지자체 정책, 정치 유튜브·평론가, 이슈 키워드를 지수로 읽습니다.",
  },
  {
    id: "economy",
    href: "/economy",
    label: "경제",
    eyebrow: "ECONOMY",
    indexTitle: "경제",
    description:
      "경제 정부지원금, 지역별 부동산, 금융, 주식, 해외 주식, 원자재·환율, 소비자 물가, 창업·프랜차이즈, 이슈 키워드를 보드로 읽습니다.",
  },
  {
    id: "culture",
    href: "/culture",
    label: "문화/생활",
    eyebrow: "CULTURE & LIVING",
    indexTitle: "문화/생활",
    description:
      "문화/생활 정부 지원금, 공연, 전시·팝업스토어, 도서·베스트셀러, 건강정보, 요리 레시피, 자동차, 이슈 키워드를 한 데스크에서 읽습니다.",
  },
  {
    id: "travel",
    href: "/travel",
    label: "여행/맛집",
    eyebrow: "TRAVEL & FOOD",
    indexTitle: "여행/맛집",
    description:
      "여행 정부지원금, 국내 여행, 해외 여행, 지역별 주말 나들이, 지역별 음식/맛집을 랭킹 보드로 읽습니다.",
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
    description: "실시간 수치와 3분봉 히트맵. 글 생성에는 이름만 넘깁니다.",
  },
  {
    id: "briefing",
    path: "/briefing",
    label: "일일브리핑",
    description: "키워드 기반 Update 키워드 브리핑, 마크다운 표, FAQ",
  },
  {
    id: "archive",
    path: "/archive",
    label: "아카이브",
    description: "지난 브리핑 목록",
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
  entertainment: [
    "kpop",
    "celebrity",
    "tv_show",
    "influencer",
    "music_chart",
    "tv_rating",
    "movie",
    "subsidy",
  ],
  culture: ["culture_board", "webtoon", "shorts", "mobile_game", "pc_game", "console_game"],
  /** Travel desks are board-seeded; no dedicated ingest entity type yet. */
  travel: [],
  economy: ["economy_board"],
  politics: POLITICS_TYPE_ORDER.filter((type) => type !== "headline_news"),
};

export function channelFromEntityType(type: EntityType): PostChannel {
  if (type === "economy_board") return "economy";
  if (type === "culture_board" || CHANNEL_ENTITY_TYPES.culture.includes(type)) return "culture";
  if (type === "headline_news") return "politics";
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
  if (/여행|맛집|나들이|숙소|항공/.test(hay)) return "travel";
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
  if (channel === "travel" && /여행|맛집|나들이|숙소|항공/.test(hay)) return true;
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
    case "travel":
      return "국내 숙박";
  }
}

export function resolveChannelSection(segment: string | null): ChannelSectionId {
  if (!segment) return "board";
  if (segment === "briefing" || segment === "archive" || segment === "about") {
    return segment;
  }
  // Retired "posts" (이슈칼럼) URLs fall back to the live board.
  return "board";
}
