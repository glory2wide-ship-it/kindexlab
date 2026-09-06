import { kstDateString } from "@/lib/briefing/dates";
import { fetchJson, fetchText, nowIso } from "@/lib/ingestion/http";
import { parseNumber, stripTags, tableRows } from "@/lib/ingestion/parse";
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

export async function fetchKobisDailyBoxOffice(): Promise<SourceResult> {
  const key = kobisApiKey();
  if (!key) {
    return result("kobis-daily", "KOBIS 일별 박스오피스", [], "no KOBIS_API_KEY");
  }

  const errors: string[] = [];
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
  return result("kobis-daily", "KOBIS 일별 박스오피스", [], errors.at(-1) ?? "empty");
}

export async function fetchNaverMovieRank(): Promise<SourceResult> {
  try {
    const html = await fetchText("https://movie.naver.com/movie/sdb/rank/rmovie.naver");
    const items: ChartRow[] = [];
    const rows = tableRows(html);
    for (const cells of rows) {
      const rank = parseNumber(cells.find((cell) => /^\d+$/.test(cell.trim())) ?? "");
      const title =
        cells.find((cell) => cell.length >= 1 && !/^\d+$/.test(cell) && !/^변동|순위|영화명/.test(cell)) ??
        "";
      if (!rank || !title || title.length > 80) continue;
      items.push({
        rank,
        title: title.replace(/\s+/g, " ").trim(),
        tags: ["네이버 영화", "박스오피스"],
        metric: Math.max(1, 40 - rank),
      });
      if (items.length >= 20) break;
    }
    if (!items.length) {
      const anchors = [
        ...html.matchAll(/class="tit[0-9]"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi),
      ];
      anchors.forEach((match, index) => {
        const title = stripTags(match[1] ?? "");
        if (!title) return;
        items.push({
          rank: index + 1,
          title,
          tags: ["네이버 영화", "박스오피스"],
          metric: Math.max(1, 40 - index),
        });
      });
    }
    return result("naver-movie", "네이버 영화 랭킹", items.slice(0, 20));
  } catch (error) {
    return result("naver-movie", "네이버 영화 랭킹", [], error instanceof Error ? error.message : "failed");
  }
}

/** CGV / portal buzz scrape — complements official box-office ranks. */
export async function fetchMaxmovieBoxOffice(): Promise<SourceResult> {
  try {
    const html = await fetchText("https://www.maxmovie.com/chart/movie");
    const items: ChartRow[] = [];
    const blocks = [
      ...html.matchAll(
        /class="[^"]*(?:rank|chart)[^"]*"[\s\S]{0,400}?<(?:a|strong|p)[^>]*>([\s\S]*?)<\/(?:a|strong|p)>/gi,
      ),
    ];
    const titles = blocks
      .map((match) => stripTags(match[1] ?? ""))
      .filter((title) => title.length >= 1 && title.length <= 60 && !/순위|예매|관객|박스/.test(title));
    const unique: string[] = [];
    for (const title of titles) {
      if (unique.some((item) => normalizeName(item) === normalizeName(title))) continue;
      unique.push(title);
      if (unique.length >= 15) break;
    }
    unique.forEach((title, index) => {
      items.push({
        rank: index + 1,
        title,
        tags: ["맥스무비", "예매"],
        metric: Math.max(1, 30 - index),
      });
    });
    return result("maxmovie", "맥스무비 영화 차트", items);
  } catch (error) {
    return result("maxmovie", "맥스무비 영화 차트", [], error instanceof Error ? error.message : "failed");
  }
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
