import { parseBracketLabel } from "@/lib/politics/labeled-rank";
import type { ContextSource } from "@/lib/context/types";
import { resolveSourceStrategy, type SourceStrategy } from "@/lib/context/source-strategy";

/**
 * Stable, citable landing pages used when live news/web retrieval returns empty.
 * These are not fabricated facts — only official/search entry points the model
 * may cite as externalLink / grounding URLs.
 */

const YOUTUBE_CHANNEL_SEEDS: Record<string, { href: string; label: string }> = {
  열린공감TV: {
    href: "https://www.youtube.com/results?search_query=%EC%97%B4%EB%A6%B0%EA%B3%B5%EA%B0%90TV",
    label: "열린공감TV 유튜브 검색",
  },
  "장성민의 시사탱크": {
    href: "https://www.youtube.com/results?search_query=%EC%9E%A5%EC%84%B1%EB%AF%BC%EC%9D%98%20%EC%8B%9C%EC%82%AC%ED%83%B1%ED%81%AC",
    label: "장성민의 시사탱크 유튜브 검색",
  },
  전원책TV: {
    href: "https://www.youtube.com/results?search_query=%EC%A0%84%EC%9B%90%EC%B1%85TV",
    label: "전원책TV 유튜브 검색",
  },
  가로세로연구소: {
    href: "https://www.youtube.com/results?search_query=%EA%B0%80%EB%A1%9C%EC%84%B8%EB%A1%9C%EC%97%B0%EA%B5%AC%EC%86%8C",
    label: "가로세로연구소 유튜브 검색",
  },
  황희두TV: {
    href: "https://www.youtube.com/results?search_query=%ED%99%A9%ED%9D%AC%EB%91%90TV",
    label: "황희두TV 유튜브 검색",
  },
};

const GRANT_ORG_HOMEPAGES: Record<string, { href: string; label: string }> = {
  한국관광공사: {
    href: "https://korean.visitkorea.or.kr/",
    label: "한국관광공사·대한민국 구석구석",
  },
  문화체육관광부: {
    href: "https://www.mcst.go.kr/",
    label: "문화체육관광부 공식",
  },
  산림청: {
    href: "https://www.forest.go.kr/",
    label: "산림청 공식",
  },
  해양수산부: {
    href: "https://www.mof.go.kr/",
    label: "해양수산부 공식",
  },
  금융위원회: {
    href: "https://www.fsc.go.kr/",
    label: "금융위원회 공식",
  },
  중소벤처기업부: {
    href: "https://www.mss.go.kr/",
    label: "중소벤처기업부 공식",
  },
  한국공예디자인문화진흥원: {
    href: "https://www.kcdf.or.kr/",
    label: "한국공예디자인문화진흥원 공식",
  },
  국민체육진흥공단: {
    href: "https://www.kspo.or.kr/",
    label: "국민체육진흥공단 공식",
  },
  한국문화예술위원회: {
    href: "https://www.arko.or.kr/",
    label: "한국문화예술위원회 공식",
  },
};

function youtubeSearchSource(keyword: string): ContextSource {
  const q = encodeURIComponent(keyword);
  return {
    title: `${keyword} 관련 유튜브 영상`,
    url: `https://www.youtube.com/results?search_query=${q}`,
    publisher: "YouTube",
    snippet: `${keyword} 채널·영상 검색 결과. 제목·설명란에 확인된 내용만 인용하세요.`,
    tier: "youtube",
  };
}

function visitKoreaSearchSource(keyword: string): ContextSource {
  const subject = parseBracketLabel(keyword)?.subject?.trim() || keyword.replace(/^\[[^\]]+\]\s*/, "");
  return {
    title: `${subject} 여행 정보 (대한민국 구석구석)`,
    url: "https://korean.visitkorea.or.kr/",
    publisher: "한국관광공사",
    snippet: `${subject} 관련 국내 관광 안내는 한국관광공사 공식 허브에서 확인합니다.`,
    tier: "web",
  };
}

function naverBlogSearchSource(keyword: string): ContextSource {
  const subject = parseBracketLabel(keyword)?.subject?.trim() || keyword.replace(/^\[[^\]]+\]\s*/, "");
  const q = encodeURIComponent(subject);
  return {
    title: `${subject} 여행·후기 검색`,
    url: `https://search.naver.com/search.naver?where=blog&query=${q}`,
    publisher: "네이버 블로그",
    snippet: `${subject} 블로그·여행기 검색. 후기 평가는 단정하지 말고 언급 수준으로만 쓰세요.`,
    tier: "web",
  };
}

function grantSearchSources(keyword: string): ContextSource[] {
  const labeled = parseBracketLabel(keyword);
  const org = labeled?.org?.trim();
  const subject = labeled?.subject?.trim() || keyword.replace(/^\[[^\]]+\]\s*/, "");
  const out: ContextSource[] = [];
  if (org && GRANT_ORG_HOMEPAGES[org]) {
    const home = GRANT_ORG_HOMEPAGES[org]!;
    out.push({
      title: `${org} 공식 안내 — ${subject}`,
      url: home.href,
      publisher: org,
      snippet: `${subject} 관련 공고·신청은 ${home.label}에서 확인합니다.`,
      tier: "web",
    });
  }
  const q = encodeURIComponent(`${org ? `${org} ` : ""}${subject} 공고`);
  out.push({
    title: `${subject} 공고·지원 안내 검색`,
    url: `https://search.naver.com/search.naver?where=webkr&query=${q}`,
    publisher: "네이버 웹문서",
    snippet: `${subject} 공고·신청·지원 대상 검색 결과. URL에 없는 금액·자격은 쓰지 마세요.`,
    tier: "web",
  });
  return out;
}

/** Returns 1–3 seed sources for the strategy so thin-news keywords still clear the URL gate. */
export function officialUrlSeeds(input: {
  keyword: string;
  boardSlug?: string | null;
  strategy?: SourceStrategy;
}): ContextSource[] {
  const keyword = input.keyword.trim();
  const strategy =
    input.strategy ??
    resolveSourceStrategy({ keyword, boardSlug: input.boardSlug }).strategy;

  if (strategy === "youtube-community") {
    const known = YOUTUBE_CHANNEL_SEEDS[keyword];
    if (known) {
      return [
        {
          title: known.label,
          url: known.href,
          publisher: "YouTube",
          snippet: `${keyword} 공식·검색 진입점. 영상 제목·설명에 확인된 내용만 인용하세요.`,
          tier: "youtube",
        },
        {
          title: `${keyword} 커뮤니티·언급 검색`,
          url: `https://search.naver.com/search.naver?where=webkr&query=${encodeURIComponent(`${keyword} 시사`)}`,
          publisher: "네이버 웹문서",
          snippet: `${keyword} 관련 커뮤니티·웹 언급 검색. 확인된 표현만 인용하세요.`,
          tier: "web",
        },
      ];
    }
    return [youtubeSearchSource(keyword)];
  }

  if (strategy === "official-grant") {
    return grantSearchSources(keyword).slice(0, 3);
  }

  if (strategy === "travel-ugc") {
    return [visitKoreaSearchSource(keyword), naverBlogSearchSource(keyword)].slice(0, 3);
  }

  return [];
}
