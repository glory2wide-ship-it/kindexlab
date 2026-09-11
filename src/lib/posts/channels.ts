import type { CategoryId, EntityType, RankingEntity } from "@/lib/types";
import { boardSlugFromEntitySlug } from "@/lib/analysis/briefing-boards";
import {
  CULTURE_ENTITY_TYPES,
  ECONOMY_ENTITY_TYPES,
  TRAVEL_ENTITY_TYPES,
} from "@/lib/boards/entity-type";
import { getBoard } from "@/lib/boards/registry";
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
    indexTitleDesktop: "여론과 시사 이슈의 흐름을 지수로 읽다, 정치 지수",
    descriptionDesktop:
      "정부 지원금, 정당·정치인 지지도, 지자체 정책, 정치 유튜브·평론가, 이슈 키워드를 지수로 읽다.",
  },
  {
    id: "economy",
    href: "/economy",
    label: "경제",
    eyebrow: "ECONOMY",
    indexTitle: "경제",
    description:
      "정부지원금, 지역별 부동산, 금융, 주식, 해외 주식, 원자재·환율, 소비자 물가, 창업*소상공, 이슈 키워드를 보드로 읽습니다.",
    indexTitleDesktop: "내 삶에 영향을 미치는 실시간 경제 이슈 지수",
    descriptionDesktop:
      "부동산, 정부지원금, 금융, 체감 물가, 이슈 종목이 일상과 시장에 미치는 영향을 차트로 확인!",
  },
  {
    id: "culture",
    href: "/culture",
    label: "문화/생활",
    eyebrow: "CULTURE & LIVING",
    indexTitle: "문화/생활",
    description:
      "정부지원금, 공연, 전시·팝업스토어, 도서·베스트셀러, 건강정보, 요리 레시피, 자동차, 이슈 키워드를 한 데스크에서 읽습니다.",
    indexTitleDesktop: "트렌디한 삶의 방식과 소비 지형도, 문화·생활 지수",
    descriptionDesktop:
      "문화, 라이프스타일, 트렌드 아이템까지 일상 속 모든 관심사의 실시간 랭킹.",
  },
  {
    id: "travel",
    href: "/travel",
    label: "여행/맛집",
    eyebrow: "TRAVEL & FOOD",
    indexTitle: "여행/맛집",
    description:
      "여행 정부지원금, 국내 여행, 해외 여행, 지역별 주말 나들이, 지역별 음식/맛집을 랭킹 보드로 읽습니다.",
    indexTitleDesktop: "차트로 만나는 미식·여행 트렌드! 여행·맛집 지수",
    descriptionDesktop:
      "국내외 여행지, 미식 트렌드, 정부 여행 지원금 혜택까지 가장 뜨거운 핫이슈를 확인!",
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
    label: "투데이 브리핑",
    description: "키워드 기반 투데이 인사이트 브리핑, 마크다운 표, FAQ",
  },
  {
    id: "archive",
    path: "/archive",
    label: "인사이트 매거진",
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

/** Site-wide section links for the landing (전체) desk. */
export function siteSectionHref(section: ChannelSectionId = "board"): string {
  switch (section) {
    case "briefing":
      return "/briefing";
    case "archive":
      return "/briefing/archive";
    case "about":
      return "/about";
    case "board":
    default:
      return "/";
  }
}

export function resolveSiteSection(pathname: string): ChannelSectionId {
  if (pathname === "/about" || pathname.startsWith("/about/")) return "about";
  if (pathname === "/briefing/archive" || pathname.startsWith("/briefing/archive/")) {
    return "archive";
  }
  if (pathname === "/briefing" || pathname.startsWith("/briefing/")) return "briefing";
  return "board";
}

/**
 * Live ingest types that feed each desk heatmap.
 *
 * Keep this aligned with visible category submenu boards only
 * (엔터 = 음원·팬덤·방송·웹툰·게임·영화·유튜버 — retired 숏폼 밈 excluded).
 * Economy/culture/travel use split types (housing, book, performance, …)
 * so each menu board owns its live tape — same pattern as entertainment.
 */
export const CHANNEL_ENTITY_TYPES: Record<PostChannel, EntityType[]> = {
  entertainment: [
    "kpop",
    "trot",
    "celebrity",
    "tv_show",
    "influencer",
    "music_chart",
    "tv_rating",
    "movie",
    "webtoon",
    "mobile_game",
    "pc_game",
    "console_game",
  ],
  culture: CULTURE_ENTITY_TYPES,
  travel: TRAVEL_ENTITY_TYPES,
  economy: ECONOMY_ENTITY_TYPES,
  politics: POLITICS_TYPE_ORDER.filter(
    (type) => type !== "headline_news" && type !== "political_ratings",
  ),
};

export function channelFromEntityType(type: EntityType): PostChannel {
  // Politics first — `subsidy` is shared with economy/travel grant boards and
  // must not pin politics programmes onto the economy desk.
  if (isPoliticsEntityType(type)) return "politics";
  if (CHANNEL_ENTITY_TYPES.economy.includes(type) || type === "economy_board") return "economy";
  if (CHANNEL_ENTITY_TYPES.travel.includes(type)) return "travel";
  if (CHANNEL_ENTITY_TYPES.culture.includes(type) || type === "culture_board") return "culture";
  return "entertainment";
}

/**
 * Resolve the desk channel for a ranking/detail entity.
 *
 * Prefer the board registry channel from `boardSlug--row` slugs so shared entity
 * types (e.g. subsidy on travel/culture/politics grant boards) do not pin the
 * sticky category chip to the wrong desk.
 */
export function channelFromLead(lead: RankingEntity, slug?: string): PostChannel {
  if (lead.sourceChannel) return lead.sourceChannel;
  const entitySlug = slug ?? lead.slug;
  if (entitySlug?.startsWith("fx-life")) return "economy";
  const boardSlug = boardSlugFromEntitySlug(entitySlug);
  if (boardSlug) {
    const board = getBoard(boardSlug);
    if (board?.channel) return board.channel;
  }
  return channelFromEntityType(lead.type);
}

export function itemsForChannel(items: RankingEntity[], channel: PostChannel): RankingEntity[] {
  const types = CHANNEL_ENTITY_TYPES[channel];
  return items.filter((item) => {
    // Retired politics menus must not re-enter via sourceChannel alone.
    if (channel === "politics") {
      if (item.type === "headline_news" || item.type === "political_ratings") return false;
      if (/^(?:pol-)?headline[_-]news(?:-|$)/i.test(item.slug)) return false;
      const group = item.heatmapGroup ?? "";
      if (group.includes("헤드라인") || group.includes("정치뉴스")) return false;
    }
    if (item.sourceChannel) return item.sourceChannel === channel;
    if (!types.length) return false;
    return types.includes(item.type);
  });
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
