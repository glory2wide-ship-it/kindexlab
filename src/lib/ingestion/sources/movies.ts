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
          // searchType must be "search" — an empty value returns the shell page
          // without tbody_0 rows (OpenAPI sample keys are frequently revoked).
          body: new URLSearchParams({
            loadEnd: "0",
            searchType: "search",
            sSearchFrom: day,
            sSearchTo: day,
            sMultiMovieYn: "",
            sRepNationCd: "",
            sWideAreaCd: "",
          }).toString(),
        },
      );
      const items: ChartRow[] = [];
      const tbody = html.match(/<tbody id="tbody_0">([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
      for (const row of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const block = row[1] ?? "";
        const rank = parseNumber(block.match(/<td[^>]*title="(\d+)"/i)?.[1]);
        const title =
          block.match(/mstView\('movie','\d+'\);[^>]*title="([^"]+)"/i)?.[1]?.trim() ||
          block.match(/<a[^>]*title="([^"]+)"[^>]*onclick="mstView\('movie'/i)?.[1]?.trim() ||
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

function isInvalidKobisKey(message: string | undefined): boolean {
  if (!message) return false;
  // KOBIS returns e.g. "유효하지않은 키값입니다." / errorCode 320010 when the
  // published sample key is revoked.
  return /유효하지\s*않은\s*키|invalid\s*key|faultInfo|320010|320001/i.test(message);
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
          faultInfo?: { message?: string; errorCode?: string };
        }>(
          `https://kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json?key=${encodeURIComponent(key)}&targetDt=${targetDt}&itemPerPage=10`,
        );
        if (data.faultInfo?.message) {
          errors.push(data.faultInfo.message);
          // Bad keys never recover across targetDt retries — jump to HTML.
          if (isInvalidKobisKey(data.faultInfo.message)) break;
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
        const message = error instanceof Error ? error.message : "failed";
        errors.push(message);
        if (isInvalidKobisKey(message)) break;
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
    if (errors.length) errors.push("html fallback empty");
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

/** Naver search box-office module (more chart-like than currently-showing scrape). */
export async function fetchNaverBoxOffice(): Promise<SourceResult> {
  try {
    const html = await fetchText(
      "https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=%EB%B0%95%EC%8A%A4%EC%98%A4%ED%94%BC%EC%8A%A4",
      { headers: { Referer: "https://www.naver.com/" } },
    );
    const items: ChartRow[] = [];
    const seen = new Set<string>();
    const blocks = [
      ...html.matchAll(/class="[^"]*(?:title|name|this_text)[^"]*"[^>]*>([\s\S]{0,80}?)<\//gi),
      ...html.matchAll(/data-title="([^"]{2,40})"/gi),
    ];
    const skip = /박스오피스|예매율|관객|더보기|영화|순위|예고편|평점|검색/;
    for (const match of blocks) {
      const title = stripTags(match[1] ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (!title || title.length < 2 || title.length > 40 || skip.test(title)) continue;
      const key = normalizeName(title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push({
        rank: items.length + 1,
        title,
        tags: ["네이버", "박스오피스"],
        metric: Math.max(1, 40 - items.length),
      });
      if (items.length >= 15) break;
    }
    return result("naver-boxoffice", "네이버 박스오피스", items);
  } catch (error) {
    return result(
      "naver-boxoffice",
      "네이버 박스오피스",
      [],
      error instanceof Error ? error.message : "failed",
    );
  }
}

/** CGV movie chart (reservation / popularity ranking). */
export async function fetchCgvMovieChart(): Promise<SourceResult> {
  try {
    const html = await fetchText("https://www.cgv.co.kr/movies/?lt=1&ft=0", {
      headers: { Referer: "https://www.cgv.co.kr/" },
    });
    const items: ChartRow[] = [];
    const seen = new Set<string>();
    for (const match of html.matchAll(
      /class="[^"]*title[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>|class="[^"]*box-contents[^"]*"[\s\S]{0,200}?strong[^>]*>([\s\S]*?)<\/strong>/gi,
    )) {
      const title = stripTags(match[1] || match[2] || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!title || title.length < 2 || title.length > 40) continue;
      if (/예매율|지금\s*상영|무비차트|CGV|더보기/.test(title)) continue;
      const key = normalizeName(title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push({
        rank: items.length + 1,
        title,
        tags: ["CGV", "예매차트"],
        metric: Math.max(1, 35 - items.length),
      });
      if (items.length >= 15) break;
    }
    return result("cgv-chart", "CGV 무비차트", items);
  } catch (error) {
    return result("cgv-chart", "CGV 무비차트", [], error instanceof Error ? error.message : "failed");
  }
}

/** Lotte Cinema current ranking list. */
export async function fetchLotteMovieChart(): Promise<SourceResult> {
  const urls = [
    "https://www.lottecinema.co.kr/NLCHS/Movie/List?flag=1",
    "https://www.lottecinema.co.kr/NLCHS/Movie",
  ];
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const html = await fetchText(url, {
        headers: { Referer: "https://www.lottecinema.co.kr/" },
      });
      const items: ChartRow[] = [];
      const seen = new Set<string>();
      for (const match of html.matchAll(
        /class="[^"]*(?:tit|title|movie_name)[^"]*"[^>]*>([\s\S]{0,100}?)<\//gi,
      )) {
        const title = stripTags(match[1] ?? "")
          .replace(/\s+/g, " ")
          .trim();
        if (!title || title.length < 2 || title.length > 40) continue;
        if (/롯데시네마|상영작|예매|더보기|영화\s*목록/.test(title)) continue;
        const key = normalizeName(title);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        items.push({
          rank: items.length + 1,
          title,
          tags: ["롯데시네마", "예매차트"],
          metric: Math.max(1, 35 - items.length),
        });
        if (items.length >= 15) break;
      }
      if (items.length) return result("lotte-chart", "롯데시네마 영화순위", items);
      errors.push("empty");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "failed");
    }
  }
  return result("lotte-chart", "롯데시네마 영화순위", [], errors.at(-1) ?? "empty");
}

/**
 * OTT viewership proxy via FlixPatrol Netflix KR top10 (public HTML).
 * Soft signal for theatrical composite — optional in health.
 */
export async function fetchOttViewershipRank(): Promise<SourceResult> {
  try {
    const html = await fetchText("https://flixpatrol.com/top10/netflix/south-korea/", {
      headers: {
        Accept: "text/html",
        Referer: "https://flixpatrol.com/",
      },
    });
    const items: ChartRow[] = [];
    const seen = new Set<string>();
    for (const match of html.matchAll(
      /<a[^>]+href="\/title\/[^"]+"[^>]*>([\s\S]{0,80}?)<\/a>/gi,
    )) {
      const title = stripTags(match[1] ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (!title || title.length < 2 || title.length > 60) continue;
      if (/Netflix|Top\s*10|FlixPatrol|Movies|Shows|MORE/i.test(title)) continue;
      const key = normalizeName(title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push({
        rank: items.length + 1,
        title,
        tags: ["OTT", "Netflix KR", "시청순위"],
        metric: Math.max(1, 30 - items.length),
      });
      if (items.length >= 10) break;
    }
    return result("ott-viewership", "OTT 시청순위(넷플릭스 KR)", items);
  } catch (error) {
    return result(
      "ott-viewership",
      "OTT 시청순위(넷플릭스 KR)",
      [],
      error instanceof Error ? error.message : "failed",
    );
  }
}

const MOVIE_SOURCE_WEIGHT: Record<string, number> = {
  "kobis-daily": 3.5,
  "naver-boxoffice": 2.5,
  "naver-movie": 2.2,
  "cgv-chart": 2,
  "lotte-chart": 2,
  "ott-viewership": 1.4,
  maxmovie: 1,
};

export async function fetchMovieSources(): Promise<SourceResult[]> {
  return Promise.all([
    fetchKobisDailyBoxOffice(),
    fetchNaverBoxOffice(),
    fetchNaverMovieRank(),
    fetchCgvMovieChart(),
    fetchLotteMovieChart(),
    fetchOttViewershipRank(),
    fetchMaxmovieBoxOffice(),
  ]);
}

/**
 * Borda-style merge: KOBIS + Naver BO + cinema charts + soft OTT signal.
 */
export function composeMovieChart(sources: SourceResult[]): ChartRow[] {
  const order = [
    "kobis-daily",
    "naver-boxoffice",
    "naver-movie",
    "cgv-chart",
    "lotte-chart",
    "ott-viewership",
    "maxmovie",
  ] as const;
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

  charts.forEach((chart) => {
    const weight = MOVIE_SOURCE_WEIGHT[chart.id] ?? 1;
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
        if (chart.id === "kobis-daily") current.title = row.title;
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
  const order = [
    "kobis-daily",
    "naver-boxoffice",
    "naver-movie",
    "cgv-chart",
    "lotte-chart",
    "ott-viewership",
    "maxmovie",
  ];
  return order.map((id) => sources.find((item) => item.id === id && item.ok)).find(Boolean);
}
