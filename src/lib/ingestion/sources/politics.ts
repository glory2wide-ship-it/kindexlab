import { fetchText, nowIso } from "@/lib/ingestion/http";
import { retrieveNewsForKeyword } from "@/lib/news/retrieve";
import { parseRssItems } from "@/lib/ingestion/parse";
import { matchPoliticsCatalog } from "@/lib/politics/catalog";
import type { ChartRow, SourceResult } from "@/lib/ingestion/types";
import type { PoliticsEntityType } from "@/lib/politics/types";

function result(id: string, label: string, items: ChartRow[], error?: string): SourceResult {
  return {
    id,
    label,
    ok: !error && items.length > 0,
    count: items.length,
    error: error ?? (items.length ? undefined : "no rows"),
    fetchedAt: nowIso(),
    items,
  };
}

const FEEDS: { id: string; label: string; url: string; type: PoliticsEntityType; tag: string }[] = [
  {
    id: "news-politics",
    label: "Google News 정치",
    url: "https://news.google.com/rss/headlines/section/topic/NATION?hl=ko&gl=KR&ceid=KR:ko",
    type: "headline_news",
    tag: "정치뉴스",
  },
  {
    id: "news-politics-search",
    label: "Google News 정치 검색",
    url: "https://news.google.com/rss/search?q=%EC%A0%95%EC%B9%98%20OR%20%EA%B5%AD%ED%9A%8C%20OR%20%EB%8C%80%EC%84%A0&hl=ko&gl=KR&ceid=KR:ko",
    type: "headline_news",
    tag: "정치검색",
  },
  {
    id: "news-party",
    label: "Google News 정당 지지도",
    url: "https://news.google.com/rss/search?q=%EC%A0%95%EB%8B%B9%20%EC%A7%80%EC%A7%80%EB%8F%84%20OR%20%EC%97%AC%EB%A1%A0%EC%A1%B0%EC%82%AC%20OR%20%EB%8D%94%EB%B6%88%EC%96%B4%EB%AF%BC%EC%A3%BC%EB%8B%B9%20OR%20%EA%B5%AD%EB%AF%BC%EC%9D%98%ED%9E%98%20OR%20%EC%A1%B0%EA%B5%AD%ED%98%81%EC%8B%A0%EB%8B%B9%20OR%20%EA%B0%9C%ED%98%81%EC%8B%A0%EB%8B%B9%20OR%20%EC%A0%95%EC%9D%98%EB%8B%B9&hl=ko&gl=KR&ceid=KR:ko",
    type: "party_support",
    tag: "정당",
  },
  {
    id: "news-politician",
    label: "Google News 정치인",
    url: "https://news.google.com/rss/search?q=%EC%A0%95%EC%B9%98%EC%9D%B8%20%EC%A7%80%EC%A7%80%EC%9C%A8%20OR%20%EB%8C%80%EC%84%A0%20%ED%9B%84%EB%B3%B4&hl=ko&gl=KR&ceid=KR:ko",
    type: "politician_support",
    tag: "정치인",
  },
  {
    id: "news-pundit",
    label: "Google News 정치 평론",
    url: "https://news.google.com/rss/search?q=%EC%A0%95%EC%B9%98%20%ED%8F%89%EB%A1%A0%20OR%20%EC%8B%9C%EC%82%AC%20%ED%86%A0%EB%A1%A0&hl=ko&gl=KR&ceid=KR:ko",
    type: "political_pundit",
    tag: "평론",
  },
  {
    id: "news-pol-influencer",
    label: "Google News 정치 유튜브",
    url: "https://news.google.com/rss/search?q=%EC%A0%95%EC%B9%98%20%EC%9C%A0%ED%8A%9C%EB%B8%8C%20OR%20%EC%8B%9C%EC%82%AC%20%EC%B1%84%EB%84%90&hl=ko&gl=KR&ceid=KR:ko",
    type: "political_influencer",
    tag: "정치유튜브",
  },
  {
    id: "news-pol-ratings",
    label: "Google News 뉴스 시청률",
    url: "https://news.google.com/rss/search?q=%EB%89%B4%EC%8A%A4%EB%8D%B0%EC%8A%A4%ED%81%AC%20OR%20%EB%89%B4%EC%8A%A4%EB%A3%B8%20%EC%8B%9C%EC%B2%AD%EB%A5%A0&hl=ko&gl=KR&ceid=KR:ko",
    type: "political_ratings",
    tag: "시청률",
  },
  {
    id: "news-policy",
    label: "Google News 지자체 정책",
    url: "https://news.google.com/rss/search?q=%EC%A7%80%EC%9E%90%EC%B2%B4%20%EC%A0%95%EC%B1%85%20OR%20%EC%84%9C%EC%9A%B8%EC%8B%9C%20%EC%A0%95%EC%B1%85&hl=ko&gl=KR&ceid=KR:ko",
    type: "local_policy",
    tag: "지자체",
  },
  {
    id: "news-subsidy",
    label: "Google News 정부 지원금",
    url: "https://news.google.com/rss/search?q=%EC%A0%95%EB%B6%80%20%EC%A7%80%EC%9B%90%EA%B8%88%20OR%20%EA%B7%BC%EB%A1%9C%EC%9E%A5%EB%A0%A4%EA%B8%88%20OR%20%EC%B2%AD%EB%85%84%EB%8F%84%EC%95%BD%EA%B3%84%EC%A2%8C&hl=ko&gl=KR&ceid=KR:ko",
    type: "subsidy",
    tag: "지원금",
  },
];

function cleanHeadline(title: string): string {
  return title
    .replace(/\s+[-–|]\s+[^-–|]+$/, "")
    .replace(/^[\[【].*?[\]】]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ingestPoliticsTitles(
  feed: (typeof FEEDS)[number],
  titles: { title: string; via?: string }[],
): ChartRow[] {
  const counts = new Map<string, ChartRow>();
  let headlineRank = 0;
  for (const item of titles) {
    const headline = cleanHeadline(item.title);
    if (feed.type === "headline_news" && headline.length >= 6 && headline.length <= 48) {
      headlineRank += 1;
      const key = `h:${headline}`;
      if (!counts.has(key)) {
        counts.set(key, {
          rank: headlineRank,
          title: headline,
          // Feed position only. Turning it into a metric saturates the
          // politics bonus at its cap, which put every board's top row on the
          // same score and froze that block at the head of the board.
          tags: [feed.tag, feed.type, item.via ?? "google-rss"].filter(Boolean),
          subtitle: item.title,
        });
      }
    }
    for (const match of matchPoliticsCatalog(item.title)) {
      const key = match.name;
      const current = counts.get(key);
      counts.set(key, {
        rank: 0,
        title: match.name,
        subtitle: match.nameEn,
        metric: (current?.metric ?? 0) + 1,
        tags: [
          ...new Set([
            ...(current?.tags ?? []),
            feed.tag,
            match.type,
            ...match.tags,
            item.via ?? "google-rss",
          ]),
        ],
      });
    }
  }
  return [...counts.values()]
    .sort((a, b) => (b.metric ?? 0) - (a.metric ?? 0) || a.rank - b.rank)
    .slice(0, 40)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

/** Query keywords used when Google News RSS is empty/failing. */
function politicsFallbackQuery(feed: (typeof FEEDS)[number]): string {
  switch (feed.id) {
    case "news-politics":
    case "news-politics-search":
      return "정치 국회 대선";
    case "news-party":
      return "정당 지지도 여론조사 더불어민주당 국민의힘 조국혁신당 개혁신당 정의당";
    case "news-politician":
      return "정치인 지지율 대선 후보";
    case "news-pundit":
      return "시사평론가 유시민 진중권 전원책 김종배 황희두 배종찬";
    case "news-pol-influencer":
      return "정치 유튜브 시사 채널";
    case "news-pol-ratings":
      return "뉴스데스크 뉴스룸 시청률";
    case "news-policy":
      return "지자체 정책 서울시 경기도";
    case "news-subsidy":
      return "정부 지원금 근로장려금 청년도약계좌";
    default:
      return feed.label;
  }
}

async function fetchPoliticsFallbackTitles(
  feed: (typeof FEEDS)[number],
): Promise<{ title: string; via: string }[]> {
  const query = politicsFallbackQuery(feed);
  try {
    const retrieval = await retrieveNewsForKeyword(query, {
      limit: 14,
      lookbackHours: 72,
      trustedOnly: false,
      allowMarketTape: true,
      skipAliasFilter: true,
      preferNaver: true,
    });
    return retrieval.docs.map((doc) => ({
      title: doc.title,
      via: doc.source || "naver-news",
    }));
  } catch {
    return [];
  }
}

async function fetchFeed(feed: (typeof FEEDS)[number]): Promise<SourceResult> {
  try {
    let titles: { title: string; via?: string }[] = [];
    let rssError: string | undefined;
    try {
      const xml = await fetchText(feed.url, {
        headers: {
          Accept: "application/rss+xml,application/xml,text/xml,*/*",
          Referer: "https://news.google.com/",
        },
      });
      titles = parseRssItems(xml).map((item) => ({ title: item.title, via: "google-rss" }));
    } catch (error) {
      rssError = error instanceof Error ? error.message : "rss failed";
    }

    let items = ingestPoliticsTitles(feed, titles);
    // P0-4: Naver / Serper (via retrieveNewsForKeyword) when RSS is empty or failed.
    if (items.length === 0) {
      const fallback = await fetchPoliticsFallbackTitles(feed);
      items = ingestPoliticsTitles(feed, fallback);
      if (items.length) {
        return result(feed.id, `${feed.label} (fallback)`, items);
      }
      return result(
        feed.id,
        feed.label,
        [],
        rssError ?? "no rows after RSS + Naver/Serper fallback",
      );
    }
    return result(feed.id, feed.label, items);
  } catch (error) {
    return result(feed.id, feed.label, [], error instanceof Error ? error.message : "failed");
  }
}

export async function fetchPoliticsSources(): Promise<SourceResult[]> {
  return Promise.all(FEEDS.map((feed) => fetchFeed(feed)));
}
