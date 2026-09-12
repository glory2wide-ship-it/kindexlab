import { kstDateString } from "@/lib/briefing/dates";
import { fetchJson, fetchText, nowIso } from "@/lib/ingestion/http";
import { parseNumber, parseRssItems, stripTags } from "@/lib/ingestion/parse";
import { normalizeName } from "@/lib/ingestion/names";
import type { ChartRow, SourceResult } from "@/lib/ingestion/types";

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

/** KOBIS daily box office usually settles for the prior KST calendar day. */
function kobisTargetDt(daysBack = 1): string {
  const today = kstDateString();
  const base = new Date(`${today}T12:00:00+09:00`);
  base.setUTCDate(base.getUTCDate() - daysBack);
  return kstDateString(base).replace(/-/g, "");
}

function kobisApiKey(): string | undefined {
  const key =
    process.env.KOBIS_API_KEY?.trim() ||
    process.env.KOFIC_API_KEY?.trim() ||
    // Official sample key published in KOBIS OpenAPI docs (server-side only).
    "82ca741a2844c5c180a208137bb92bd7";
  return key || undefined;
}

function kobisHtmlDate(daysBack = 1): string {
  const raw = kobisTargetDt(daysBack);
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/** Public KOBIS HTML board — used when the OpenAPI sample key is revoked. */
async function fetchKobisDailyFromHtml(): Promise<ChartRow[]> {
  const errors: string[] = [];
  for (const daysBack of [1, 2, 3]) {
    const day = kobisHtmlDate(daysBack);
    try {
      const html = await fetchText(
        "https://www.kobis.or.kr/kobis/business/stat/boxs/findDailyBoxOfficeList.do",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Referer: "https://www.kobis.or.kr/kobis/business/stat/boxs/findDailyBoxOfficeList.do",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: new URLSearchParams({
            loadEnd: "0",
            searchType: "",
            sSearchFrom: day,
            sSearchTo: day,
            sMultiMovieYn: "",
            sRepNationCd: "",
            sWideAreaCd: "",
          }).toString(),
        },
      );
      const items: ChartRow[] = [];
      const tbody = html.match(/<tbody id="tbody_0">([\s\S]*?)<\/tbody>/i)?.[1] ?? html;
      for (const row of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const block = row[1] ?? "";
        const rank = parseNumber(block.match(/<td[^>]*title="(\d+)"/i)?.[1]);
        const title =
          block.match(/mstView\('movie','\d+'\);[^>]*title="([^"]+)"/i)?.[1]?.trim() ||
          block.match(/mstView\('movie','\d+'\);[^>]*>([^<]+)</i)?.[1]?.trim();
        if (!title || !rank) continue;
        const cells = [...block.matchAll(/<td[^>]*class="tar"[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
          stripTags(m[1] ?? "")
            .replace(/\([^)]*\)/g, "")
            .replace(/[^\d]/g, ""),
        );
        // Column order: sales, share, salesChange, salesAcc, audience, audienceChange, audienceAcc, ...
        const audience = parseNumber(cells[4]) ?? parseNumber(cells[6]);
        items.push({
          rank,
          title,
          metric: audience ?? Math.max(1, 40 - rank),
          volume: audience,
          measurement: audience
            ? { value: audience, unit: "명", label: "당일 관객", source: "KOBIS" }
            : undefined,
          tags: ["KOBIS", "박스오피스", "HTML"],
        });
      }
      if (items.length) return items.slice(0, 15);
      errors.push(`${day}: empty html`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "html failed");
    }
  }
  if (errors.length) {
    /* fall through */
  }
  return [];
}

export async function fetchKobisDailyBoxOffice(): Promise<SourceResult> {
  const key = kobisApiKey();
  const errors: string[] = [];

  if (key) {
    for (const daysBack of [1, 2, 3]) {
      const targetDt = kobisTargetDt(daysBack);
      try {
        const data = await fetchJson<{
          boxOfficeResult?: {
            dailyBoxOfficeList?: {
              rank?: string;
              movieNm?: string;
              audiCnt?: string;
              audiAcc?: string;
              salesAmt?: string;
              rankInten?: string;
            }[];
          };
          faultInfo?: { message?: string };
        }>(
          `https://kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json?key=${encodeURIComponent(key)}&targetDt=${targetDt}&itemPerPage=10`,
        );
        if (data.faultInfo?.message) {
          errors.push(data.faultInfo.message);
          continue;
        }
        const items = (data.boxOfficeResult?.dailyBoxOfficeList ?? []).flatMap((row, index) => {
          const title = row.movieNm?.trim();
          if (!title) return [];
          const rank = parseNumber(row.rank) ?? index + 1;
          const audience = parseNumber(row.audiCnt);
          const previousDelta = parseNumber(row.rankInten);
          const item: ChartRow = {
            rank,
            previousRank:
              previousDelta != null && Number.isFinite(previousDelta)
                ? rank + previousDelta
                : undefined,
            title,
            metric: audience ?? Math.max(1, 40 - index),
            volume: audience,
            measurement: audience
              ? { value: audience, unit: "명", label: "당일 관객", source: "KOBIS" }
              : undefined,
            tags: ["KOBIS", "박스오피스"],
          };
          return [item];
        });
        if (items.length) return result("kobis-daily", "KOBIS 일별 박스오피스", items);
        errors.push(`${targetDt}: empty`);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "failed");
      }
    }
  } else {
    errors.push("no KOBIS_API_KEY");
  }

  try {
    const htmlItems = await fetchKobisDailyFromHtml();
    if (htmlItems.length) {
      return result("kobis-daily", "KOBIS 일별 박스오피스", htmlItems);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "html fallback failed");
  }

  return result("kobis-daily", "KOBIS 일별 박스오피스", [], errors.at(-1) ?? "empty");
}

export async function fetchNaverMovieRank(): Promise<SourceResult> {
  // Legacy /movie/sdb/rank/rmovie.naver now redirects to a generic search shell.
  // Fall back to the Naver "박스오피스" search module's currently-showing list.
  try {
    const html = await fetchText(
      "https://search.naver.com/search.naver?where=nexearch&query=%EB%B0%95%EC%8A%A4%EC%98%A4%ED%94%BC%EC%8A%A4",
      { headers: { Referer: "https://www.naver.com/" } },
    );
    const items: ChartRow[] = [];
    const seen = new Set<string>();
    const skip =
      /이런 영화|박스오피스|기본정보|브라우저|숏텐츠|뉴스|위키|지식|검색|더보기|예매|무비차트|클래식/;
    for (const match of html.matchAll(/class="[^"]*title[^"]*"[^>]*>([\s\S]{0,120}?)<\//gi)) {
      const title = stripTags(match[1] ?? "")
        .replace(/\s+/g, " ")
        .replace(/\.{2,}$/, "")
        .trim();
      if (!title || title.length < 2 || title.length > 40 || skip.test(title)) continue;
      const key = normalizeName(title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push({
        rank: items.length + 1,
        title,
        tags: ["네이버 영화", "현재상영"],
        metric: Math.max(1, 40 - items.length),
      });
      if (items.length >= 20) break;
    }
    return result("naver-movie", "네이버 영화 랭킹", items);
  } catch (error) {
    return result("naver-movie", "네이버 영화 랭킹", [], error instanceof Error ? error.message : "failed");
  }
}

/** Google News / portal movie buzz — fills gaps when KOBIS key is unavailable. */
export async function fetchMaxmovieBoxOffice(): Promise<SourceResult> {
  const urls = [
    "https://news.google.com/rss/search?q=%EB%B0%95%EC%8A%A4%EC%98%A4%ED%94%BC%EC%8A%A4%20OR%20%EC%98%88%EB%A7%A4%EC%9C%A8&hl=ko&gl=KR&ceid=KR:ko",
    "https://news.google.com/rss/search?q=%EC%98%81%ED%99%94%20%ED%9D%A5%ED%96%89&hl=ko&gl=KR&ceid=KR:ko",
  ];
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const xml = await fetchText(url, {
        headers: { Accept: "application/rss+xml,application/xml,text/xml,*/*" },
      });
      const items: ChartRow[] = [];
      const seen = new Set<string>();
      for (const item of parseRssItems(xml)) {
        const quoted = [...item.title.matchAll(/[「『“"'‘]([^」』”"'’]{2,30})[」』”"'’]/g)].map(
          (match) => match[1] ?? "",
        );
        const cleaned = item.title
          .replace(/\s+[-–|]\s+[^-–|]+$/, "")
          .replace(/^[\[【].*?[\]】]\s*/, "")
          .trim();
        const candidates = quoted.length
          ? quoted
          : [cleaned.replace(/[…]|(\.\.\.)/g, "").slice(0, 40)];
        for (const raw of candidates) {
          const title = stripTags(raw).replace(/\s+/g, " ").trim();
          if (!title || title.length < 2 || /박스|관객|예매율|박스오피스|영화진흥/.test(title)) continue;
          const key = normalizeName(title);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          items.push({
            rank: items.length + 1,
            title,
            tags: ["영화 뉴스", "흥행"],
            metric: Math.max(1, 30 - items.length),
            subtitle: cleaned.slice(0, 80),
          });
          if (items.length >= 15) break;
        }
        if (items.length >= 15) break;
      }
      if (items.length) return result("maxmovie", "영화 흥행 뉴스", items);
      errors.push("empty");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "failed");
    }
  }
  return result("maxmovie", "영화 흥행 뉴스", [], errors.at(-1) ?? "empty");
}

export async function fetchMovieSources(): Promise<SourceResult[]> {
  return Promise.all([fetchKobisDailyBoxOffice(), fetchNaverMovieRank(), fetchMaxmovieBoxOffice()]);
}

/**
 * Borda-style merge: KOBIS audience counts weigh heaviest, portal ranks fill gaps.
 */
export function composeMovieChart(sources: SourceResult[]): ChartRow[] {
  const order = ["kobis-daily", "naver-movie", "maxmovie"] as const;
  const charts = order
    .map((id) => sources.find((item) => item.id === id && item.ok))
    .filter((item): item is SourceResult => Boolean(item));
  if (!charts.length) return [];

  type Acc = {
    title: string;
    tags: string[];
    points: number;
    bestRank: number;
    metric: number;
    volume?: number;
    measurement?: ChartRow["measurement"];
  };
  const map = new Map<string, Acc>();

  charts.forEach((chart, chartIndex) => {
    const weight = chart.id === "kobis-daily" ? 3 : chart.id === "naver-movie" ? 2 : 1;
    for (const row of chart.items.slice(0, 20)) {
      const key = normalizeName(row.title);
      if (!key) continue;
      const current = map.get(key);
      const points = weight * Math.max(1, 21 - row.rank);
      const metricBoost = (row.metric ?? 0) * (chart.id === "kobis-daily" ? 1 : 0.01);
      if (!current) {
        map.set(key, {
          title: row.title,
          tags: [...(row.tags ?? [])],
          points: points + metricBoost / 100_000,
          bestRank: row.rank,
          metric: row.metric ?? points,
          volume: row.volume,
          measurement: row.measurement,
        });
      } else {
        current.points += points + metricBoost / 100_000;
        current.bestRank = Math.min(current.bestRank, row.rank);
        current.metric = Math.max(current.metric, row.metric ?? 0);
        current.tags = [...new Set([...current.tags, ...(row.tags ?? [])])];
        if (!current.measurement && row.measurement) current.measurement = row.measurement;
        if (!current.volume && row.volume) current.volume = row.volume;
        // Prefer KOBIS title casing when present.
        if (chartIndex === 0) current.title = row.title;
      }
    }
  });

  return [...map.values()]
    .sort((a, b) => b.points - a.points || a.bestRank - b.bestRank)
    .slice(0, 30)
    .map((row, index) => ({
      rank: index + 1,
      title: row.title,
      metric: row.metric || Math.max(1, 40 - index),
      volume: row.volume,
      measurement: row.measurement,
      tags: [...new Set([...row.tags, "영화 랭킹지수"])],
    }));
}

export function pickPrimaryMovie(sources: SourceResult[]): SourceResult | undefined {
  const composed = composeMovieChart(sources);
  if (composed.length) {
    return {
      id: "movie-composite",
      label: "영화 랭킹지수(복합)",
      ok: true,
      count: composed.length,
      fetchedAt: nowIso(),
      items: composed,
    };
  }
  const order = ["kobis-daily", "naver-movie", "maxmovie"];
  return order.map((id) => sources.find((item) => item.id === id && item.ok)).find(Boolean);
}
