import { catalogEntries, matchCatalog } from "@/lib/ingestion/catalog";
import { fetchJson, fetchText, nowIso } from "@/lib/ingestion/http";
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import { parseNumber, parseRssItems } from "@/lib/ingestion/parse";
import type { ChartRow, SourceResult } from "@/lib/ingestion/types";
import type { EntityType } from "@/lib/types";

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

const FEEDS = [
  {
    id: "news-ent",
    label: "Google News 연예",
    url: "https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=ko&gl=KR&ceid=KR:ko",
    tag: "연예뉴스",
  },
  {
    id: "news-kpop",
    label: "Google News K-POP",
    url: "https://news.google.com/rss/search?q=K-POP%20OR%20%EC%95%84%EC%9D%B4%EB%8F%8C&hl=ko&gl=KR&ceid=KR:ko",
    tag: "아이돌뉴스",
  },
  {
    id: "news-tv",
    label: "Google News 방송",
    url: "https://news.google.com/rss/search?q=%EC%98%88%EB%8A%A5%20OR%20%EB%93%9C%EB%9D%BC%EB%A7%88&hl=ko&gl=KR&ceid=KR:ko",
    tag: "방송뉴스",
  },
  {
    id: "news-creator",
    label: "Google News 크리에이터",
    url: "https://news.google.com/rss/search?q=%EC%9C%A0%ED%8A%9C%EB%B2%84%20OR%20%EC%9D%B8%ED%94%8C%EB%A3%A8%EC%96%B8%EC%84%9C&hl=ko&gl=KR&ceid=KR:ko",
    tag: "크리에이터",
  },
];

function cleanHeadline(title: string): string {
  return title.replace(/\s+[-–|]\s+[^-–|]+$/, "").replace(/^[\[【].*?[\]】]\s*/, "").trim();
}

function extractNames(title: string): string[] {
  const cleaned = cleanHeadline(title);
  const quoted = [...cleaned.matchAll(/[「『“"‘']([^」』”"’']{2,20})[」』”"’']/g)].map((m) => m[1] ?? "");
  const catalogHits = catalogEntries()
    .filter((item) => namesOverlap(item.name, cleaned) || namesOverlap(item.nameEn, cleaned))
    .map((item) => item.name);
  return [...new Set([...quoted, ...catalogHits])].filter(Boolean);
}

export async function fetchGoogleNewsFeeds(): Promise<SourceResult[]> {
  return Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const xml = await fetchText(feed.url, { headers: { Accept: "application/rss+xml,application/xml,text/xml" } });
        const counts = new Map<string, ChartRow>();
        for (const item of parseRssItems(xml)) {
          const names = extractNames(item.title).filter((name) => {
            const known = matchCatalog(name);
            if (known) return true;
            if (/\s/.test(name) && name.length > 8) return false;
            return name.length >= 2 && name.length <= 14;
          });
          if (!names.length) continue;
          for (const name of names) {
            const current = counts.get(name);
            counts.set(name, {
              rank: 0,
              title: name,
              metric: (current?.metric ?? 0) + 1,
              tags: [feed.tag],
              subtitle: item.title,
            });
          }
        }
        const items = [...counts.values()]
          .sort((a, b) => (b.metric ?? 0) - (a.metric ?? 0))
          .slice(0, 40)
          .map((item, index) => ({ ...item, rank: index + 1 }));
        return result(feed.id, feed.label, items);
      } catch (error) {
        return result(feed.id, feed.label, [], error instanceof Error ? error.message : "failed");
      }
    }),
  );
}

export async function fetchGoogleTrendsKr(): Promise<SourceResult> {
  const urls = [
    "https://trends.google.com/trending/rss?geo=KR",
    "https://trends.google.com/trends/trendingsearches/daily/rss?geo=KR",
  ];
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const xml = await fetchText(url, { headers: { Accept: "application/rss+xml,application/xml" } });
      const items = parseRssItems(xml).map((item, index) => {
        const traffic = parseNumber(xml.match(new RegExp(`${item.title}[\\s\\S]{0,200}?([\\d,]+)\\+?`))?.[1]);
        return {
          rank: index + 1,
          title: item.title,
          metric: traffic,
          tags: ["Google Trends KR"],
        };
      });
      if (items.length) return result("google-trends", "Google Trends 한국", items.slice(0, 30));
      errors.push("empty");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "failed");
    }
  }
  return result("google-trends", "Google Trends 한국", [], errors.at(-1) ?? "empty");
}

export async function fetchNaverNewsBoost(names: string[]): Promise<Map<string, number>> {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  const boosts = new Map<string, number>();
  if (!id || !secret) return boosts;

  for (const name of names.slice(0, 12)) {
    try {
      const data = await fetchJson<{ total?: number }>(
        `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(name)}&display=1`,
        {
          headers: {
            "X-Naver-Client-Id": id,
            "X-Naver-Client-Secret": secret,
            Accept: "application/json",
          },
        },
      );
      if (typeof data.total === "number") boosts.set(name, data.total);
    } catch {
      // Optional signal; skip failed queries.
    }
  }
  return boosts;
}

export function classifyBuzzType(name: string, tags: string[]): EntityType {
  const known = matchCatalog(name);
  if (known) return known.type;
  const blob = `${name} ${tags.join(" ")}`;
  if (/유튜버|인플루언서|스트리머|BJ|크리에이터/.test(blob)) return "influencer";
  if (/예능|드라마|방송|뉴스/.test(blob)) return "tv_show";
  if (/아이돌|K-?POP|걸그룹|보이그룹/.test(blob)) return "kpop";
  return "celebrity";
}

export async function fetchBuzzSources(): Promise<SourceResult[]> {
  const [feeds, trends] = await Promise.all([fetchGoogleNewsFeeds(), fetchGoogleTrendsKr()]);
  return [...feeds, trends];
}
