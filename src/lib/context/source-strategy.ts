import { boardSlugFromEntitySlug } from "@/lib/analysis/briefing-boards";
import {
  boardSensePromptBlock,
  mergeSenseQueries,
  resolveBoardSense,
} from "@/lib/boards/sense";
import { parseBracketLabel } from "@/lib/politics/labeled-rank";
import type { RankingEntity } from "@/lib/types";

/**
 * RAG source bias for keywords that rarely appear in legacy news RSS.
 * News is still collected as a supplement; the strategy only changes priority.
 */
export type SourceStrategy =
  | "news-first"
  | "news-then-ugc"
  | "youtube-community"
  | "official-grant"
  | "travel-ugc"
  | "review-web";

export interface SourceStrategyPlan {
  strategy: SourceStrategy;
  /** Extra search queries tailored to the strategy (in priority order). */
  queries: string[];
  /** Prompt label injected into the RAG block. */
  promptHint: string;
  /** Prefer YouTube/community before waiting on news. */
  prioritizeYoutube: boolean;
  /** Prefer Naver blog / travelogues. */
  prioritizeBlog: boolean;
  /** Prefer ministry/agency announcement pages. */
  prioritizeOfficial: boolean;
  /** Allow Serper to keep UGC hosts (cafe, community, blog). */
  allowUgc: boolean;
  youtubeLimit: number;
  blogLimit: number;
  webLimit: number;
}

const YOUTUBE_BOARDS = new Set([
  "political-influencer-power",
  "finance-youtube-power",
  "entertain-youtuber-ranking",
  "political-pundit-ranking",
  "money-youtuber-influence",
]);

const GRANT_BOARDS = new Set([
  "travel-government-grant-ranking",
  "culture-leisure-grant-ranking",
  "entertainment-government-grant-ranking",
  "government-subsidy-search",
  "government-support-fund",
]);

const TRAVEL_UGC_BOARDS = new Set([
  "domestic-travel-ranking",
  "overseas-travel-ranking",
  "weekend-outing-ranking",
  "food-restaurant-ranking",
]);

const CULTURE_NEWS_BOARDS = new Set([
  "health-info-ranking",
  "recipe-ranking",
  "car-review-ranking",
  "culture-issue-keywords",
  "ott-buzz-ranking",
]);

/** Product/service review boards — blogs, portals, YouTube over thin RSS. */
const REVIEW_WEB_BOARDS = new Set([
  "housing-subscription-hotspot",
]);

function cleanKeyword(keyword: string): string {
  return keyword.replace(/\s+/g, " ").trim();
}

function grantQueries(keyword: string): string[] {
  const labeled = parseBracketLabel(keyword);
  const subject = labeled?.subject?.trim() || cleanKeyword(keyword).replace(/^\[[^\]]+\]\s*/, "");
  const org = labeled?.org?.trim();
  const queries = [
    `${subject} 공고`,
    `${subject} 신청`,
    `${subject} 지원사업`,
    org ? `${org} ${subject}` : "",
    org ? `${org} ${subject} 공고` : "",
    `${subject} site:go.kr`,
    `${subject} site:or.kr`,
  ].filter(Boolean);
  return [...new Set(queries)];
}

function youtubeQueries(keyword: string): string[] {
  const base = cleanKeyword(keyword);
  return [...new Set([base, `${base} 유튜브`, `${base} 시사`, `${base} 최신 영상`, `${base} 라이브`])];
}

function travelQueries(keyword: string): string[] {
  const base = cleanKeyword(keyword);
  return [...new Set([base, `${base} 여행`, `${base} 후기`, `${base} 여행기`, `${base} 가볼만한곳`, `${base} 코스`])];
}

function reviewQueries(keyword: string, boardSlug: string): string[] {
  const base = cleanKeyword(keyword);
  if (boardSlug === "housing-subscription-hotspot") {
    return [...new Set([base, `${base} 분양`, `${base} 청약`, `${base} 부동산`, `${base} 시세`])];
  }
  return [...new Set([base, `${base} 리뷰`, `${base} 후기`, `${base} 정보`])];
}

function economyNewsQueries(keyword: string): string[] {
  const base = cleanKeyword(keyword);
  return [...new Set([base, `${base} 경제`, `${base} 금리`, `${base} 증시`, `${base} 네이버 뉴스`])];
}

export function resolveSourceStrategy(input: {
  keyword: string;
  boardSlug?: string | null;
  entity?: RankingEntity | null;
  channel?: string | null;
}): SourceStrategyPlan {
  const keyword = cleanKeyword(input.keyword);
  const boardSlug =
    input.boardSlug?.trim() ||
    boardSlugFromEntitySlug(input.entity?.slug) ||
    "";
  const type = input.entity?.type ?? "";
  const channel = input.channel ?? input.entity?.sourceChannel ?? "";
  const labeled = parseBracketLabel(keyword);
  const looksLikeGrantCopy =
    /지원금|지원사업|이용권|바우처|휴가지원|도약계좌|공모|보조금|장려금/i.test(keyword) ||
    /부$|청$|공단$|공사$|진흥원$|위원회$/.test(labeled?.org ?? "");

  let plan: SourceStrategyPlan;

  if (
    YOUTUBE_BOARDS.has(boardSlug) ||
    type === "political_influencer" ||
    type === "political_pundit" ||
    /TV$|연구소|시사탱크|공감TV|유튜브|평론가|시사평론/i.test(keyword)
  ) {
    plan = {
      strategy: "youtube-community",
      queries: youtubeQueries(keyword),
      promptHint:
        "[소스 전략: 유튜브·커뮤니티 중심] 뉴스보다 영상 제목·설명·커뮤니티 언급을 1차 근거로 쓰세요. 확인된 URL·스니펫만 인용하고, 채널 발언을 기사처럼 단정하지 마세요.",
      prioritizeYoutube: true,
      prioritizeBlog: true,
      prioritizeOfficial: false,
      allowUgc: true,
      youtubeLimit: 8,
      blogLimit: 6,
      webLimit: 6,
    };
  } else if (
    GRANT_BOARDS.has(boardSlug) ||
    type === "subsidy" ||
    looksLikeGrantCopy ||
    (labeled && /부$|청$|공단$|공사$|진흥원$|위원회$/.test(labeled.org))
  ) {
    plan = {
      strategy: "official-grant",
      queries: grantQueries(keyword),
      promptHint:
        "[소스 전략: 공식 홈페이지 → 최근 뉴스] 소관 기관 공식·공고·신청 안내를 1차 근거로 쓰고, 부족하면 최근 뉴스 보도로 보완하세요. 블로그 후기보다 공식 문구·일정·대상을 우선하고, URL에 없는 금액·자격은 지어내지 마세요.",
      prioritizeYoutube: false,
      prioritizeBlog: false,
      prioritizeOfficial: true,
      allowUgc: false,
      youtubeLimit: 3,
      blogLimit: 2,
      webLimit: 10,
    };
  } else if (
    TRAVEL_UGC_BOARDS.has(boardSlug) ||
    CULTURE_NEWS_BOARDS.has(boardSlug) ||
    ((channel === "travel" || channel === "culture") &&
      !GRANT_BOARDS.has(boardSlug) &&
      !looksLikeGrantCopy) ||
    /여행|관광|맛집|핫플|밤바다|휴양림|축제|카페거리|건강|레시피|시승/i.test(keyword)
  ) {
    plan = {
      strategy: "news-then-ugc",
      queries: travelQueries(labeled?.subject ? `${labeled.subject}` : keyword),
      promptHint:
        "[소스 전략: 최근 뉴스 1차 → 블로그·유튜브 보완] 최근 뉴스를 1차 근거로 쓰세요. 뉴스가 부족할 때만 네이버 블로그·여행기·유튜브 영상으로 보완하고, 개인 후기의 주관적 평가는 ‘후기에서 언급’ 수준으로 쓰세요.",
      prioritizeYoutube: false,
      prioritizeBlog: false,
      prioritizeOfficial: false,
      allowUgc: true,
      youtubeLimit: 6,
      blogLimit: 8,
      webLimit: 6,
    };
  } else if (
    REVIEW_WEB_BOARDS.has(boardSlug) ||
    /시승기|분양|청약/i.test(keyword)
  ) {
    plan = {
      strategy: "review-web",
      queries: reviewQueries(keyword, boardSlug),
      promptHint:
        "[소스 전략: 리뷰·포털·웹문서 중심] 뉴스 RSS가 얇을 때 공식 안내·포털·블로그·유튜브 리뷰를 1차 근거로 쓰세요. 확인된 고유명사·제품명·단지명만 랭킹에 넣고, URL에 없는 수치·효능은 지어내지 마세요.",
      prioritizeYoutube: false,
      prioritizeBlog: true,
      prioritizeOfficial: boardSlug === "housing-subscription-hotspot",
      allowUgc: true,
      youtubeLimit: 5,
      blogLimit: 8,
      webLimit: 8,
    };
  } else if (channel === "economy") {
    plan = {
      strategy: "news-first",
      queries: economyNewsQueries(keyword),
      promptHint:
        "[소스 전략: 네이버 경제 뉴스 중심] 네이버·포털 경제 뉴스를 1차 근거로 쓰고, 유튜브·웹문서로 보완하세요. 확인된 종목·지표·상품명만 쓰세요.",
      prioritizeYoutube: true,
      prioritizeBlog: false,
      prioritizeOfficial: false,
      allowUgc: false,
      youtubeLimit: 6,
      blogLimit: 4,
      webLimit: 8,
    };
  } else {
    plan = {
      strategy: "news-first",
      queries: [keyword],
      promptHint: "",
      prioritizeYoutube: true,
      prioritizeBlog: false,
      prioritizeOfficial: false,
      allowUgc: false,
      youtubeLimit: 6,
      blogLimit: 5,
      webLimit: 8,
    };
  }

  // Every strategy inherits board-sense query bias + prompt lock so homonyms
  // (코스모스/원피스/애플 …) stay in the heatmap board's unit meaning.
  const sense = resolveBoardSense({
    boardSlug,
    entitySlug: input.entity?.slug,
    keyword,
  });
  return {
    ...plan,
    queries: mergeSenseQueries(keyword, plan.queries, sense),
    promptHint: [plan.promptHint, boardSensePromptBlock(sense)].filter(Boolean).join("\n\n"),
  };
}
