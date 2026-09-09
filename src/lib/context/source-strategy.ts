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
  | "youtube-community"
  | "official-grant"
  | "travel-ugc";

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
    /TV$|연구소|시사탱크|공감TV|유튜브/i.test(keyword)
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
    // Travel place boards before generic "[기관] 사업" detection — regional labels
    // like "[전남] 여수 밤바다" are places, not grant programs.
    TRAVEL_UGC_BOARDS.has(boardSlug) ||
    ((channel === "travel" || boardSlug.startsWith("travel-") || boardSlug.includes("travel")) &&
      !GRANT_BOARDS.has(boardSlug) &&
      !looksLikeGrantCopy)
  ) {
    plan = {
      strategy: "travel-ugc",
      queries: travelQueries(labeled?.subject ? `${labeled.subject}` : keyword),
      promptHint:
        "[소스 전략: 여행·블로그 후기 중심] 네이버 블로그·여행기·후기를 1차 근거로 쓰세요. 개인 후기의 주관적 평가는 ‘후기에서 언급’ 수준으로 쓰고, 확인된 지명·코스·시즌 정보 위주로 정리하세요.",
      prioritizeYoutube: false,
      prioritizeBlog: true,
      prioritizeOfficial: false,
      allowUgc: true,
      youtubeLimit: 3,
      blogLimit: 8,
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
        "[소스 전략: 공고·기관 페이지 중심] 소관 기관·공고·신청 안내 페이지를 1차 근거로 쓰세요. 블로그 후기보다 공식 문구·일정·대상을 우선하고, URL에 없는 금액·자격은 지어내지 마세요.",
      prioritizeYoutube: false,
      prioritizeBlog: false,
      prioritizeOfficial: true,
      allowUgc: false,
      youtubeLimit: 2,
      blogLimit: 2,
      webLimit: 10,
    };
  } else if (/여행|관광|맛집|핫플|밤바다|휴양림|축제|카페거리/i.test(keyword)) {
    plan = {
      strategy: "travel-ugc",
      queries: travelQueries(labeled?.subject || keyword),
      promptHint:
        "[소스 전략: 여행·블로그 후기 중심] 네이버 블로그·여행기·후기를 1차 근거로 쓰세요. 개인 후기의 주관적 평가는 ‘후기에서 언급’ 수준으로 쓰고, 확인된 지명·코스·시즌 정보 위주로 정리하세요.",
      prioritizeYoutube: false,
      prioritizeBlog: true,
      prioritizeOfficial: false,
      allowUgc: true,
      youtubeLimit: 3,
      blogLimit: 8,
      webLimit: 6,
    };
  } else {
    plan = {
      strategy: "news-first",
      queries: [keyword],
      promptHint: "",
      prioritizeYoutube: false,
      prioritizeBlog: false,
      prioritizeOfficial: false,
      allowUgc: false,
      youtubeLimit: 5,
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
