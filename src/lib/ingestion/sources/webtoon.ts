import { kstDateString } from "@/lib/briefing/dates";
import { fetchJson, nowIso } from "@/lib/ingestion/http";
import type { ChartRow, SourceResult } from "@/lib/ingestion/types";

const NAVER_WEEKS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun", "dailyPlus"] as const;

const NAVER_HEADERS = {
  Accept: "application/json",
  Referer: "https://comic.naver.com/webtoon/weekday",
};

interface NaverTitle {
  titleId?: number;
  titleName?: string;
  author?: string;
  thumbnailUrl?: string;
  starScore?: number;
  viewCount?: number;
  adult?: boolean;
  new?: boolean;
  up?: boolean;
  rest?: boolean;
  finish?: boolean;
}

interface NaverWeekdayPayload {
  titleList?: NaverTitle[];
  titleListMap?: Record<string, NaverTitle[]>;
}

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

function todayWeekParam(date = new Date()): (typeof NAVER_WEEKS)[number] {
  const kst = kstDateString(date);
  const day = new Date(`${kst}T12:00:00+09:00`).getUTCDay();
  const map: Record<number, (typeof NAVER_WEEKS)[number]> = {
    0: "sun",
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
    6: "sat",
  };
  return map[day] ?? "mon";
}

function titlesFromPayload(data: NaverWeekdayPayload): NaverTitle[] {
  if (Array.isArray(data.titleList) && data.titleList.length) return data.titleList;
  if (data.titleListMap) return Object.values(data.titleListMap).flat();
  return [];
}

function rowFromTitle(title: NaverTitle, rank: number, tag: string): ChartRow | undefined {
  const name = title.titleName?.trim();
  if (!name || title.adult) return undefined;
  const views = typeof title.viewCount === "number" ? title.viewCount : 0;
  const stars = typeof title.starScore === "number" ? title.starScore : 0;
  const flags = [
    title.new ? "신작" : undefined,
    title.up ? "업데이트" : undefined,
    title.rest ? "휴재" : undefined,
    title.finish ? "완결" : undefined,
  ].filter((item): item is string => Boolean(item));
  return {
    rank,
    title: name,
    subtitle: title.author,
    metric: stars,
    volume: views > 0 ? views : undefined,
    // The star score is the reader-facing number Naver publishes, so prefer it
    // over the view count, which the API reports inconsistently across weekdays.
    measurement:
      stars > 0
        ? { value: stars, unit: "점", label: "독자 별점", source: "네이버웹툰" }
        : views > 0
          ? { value: views, unit: "회", label: "조회수", source: "네이버웹툰" }
          : undefined,
    imageUrl: title.thumbnailUrl,
    tags: [tag, ...flags].slice(0, 5),
  };
}

async function fetchNaverWeek(week: string): Promise<NaverTitle[]> {
  const data = await fetchJson<NaverWeekdayPayload>(
    `https://comic.naver.com/api/webtoon/titlelist/weekday?week=${week}&order=view`,
    { headers: NAVER_HEADERS },
  );
  return titlesFromPayload(data);
}

function uniqueTitles(titles: NaverTitle[]): NaverTitle[] {
  const map = new Map<number, NaverTitle>();
  for (const title of titles) {
    if (!title.titleId || title.adult) continue;
    const current = map.get(title.titleId);
    if (!current || (title.viewCount ?? 0) > (current.viewCount ?? 0)) {
      map.set(title.titleId, title);
    }
  }
  return [...map.values()].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0) || (b.starScore ?? 0) - (a.starScore ?? 0));
}

export async function fetchNaverWebtoonDaily(): Promise<SourceResult> {
  const week = todayWeekParam();
  try {
    const titles = uniqueTitles(await fetchNaverWeek(week));
    const items = titles
      .slice(0, 40)
      .map((title, index) => rowFromTitle(title, index + 1, "네이버 일간"))
      .filter((item): item is ChartRow => Boolean(item));
    return result("naver-webtoon-daily", "네이버웹툰 일간 인기", items);
  } catch (error) {
    return result(
      "naver-webtoon-daily",
      "네이버웹툰 일간 인기",
      [],
      error instanceof Error ? error.message : "failed",
    );
  }
}

export async function fetchNaverWebtoonWeekly(): Promise<SourceResult> {
  try {
    const batches = await Promise.all(NAVER_WEEKS.map((week) => fetchNaverWeek(week).catch(() => [] as NaverTitle[])));
    const titles = uniqueTitles(batches.flat());
    const items = titles
      .slice(0, 50)
      .map((title, index) => rowFromTitle(title, index + 1, "네이버 주간"))
      .filter((item): item is ChartRow => Boolean(item));
    return result("naver-webtoon-weekly", "네이버웹툰 주간 인기", items);
  } catch (error) {
    return result(
      "naver-webtoon-weekly",
      "네이버웹툰 주간 인기",
      [],
      error instanceof Error ? error.message : "failed",
    );
  }
}

interface KakaoCard {
  title?: string;
  author?: string;
  thumbnail?: string;
  rank?: number;
  score?: number;
}

export async function fetchKakaoWebtoonRanking(): Promise<SourceResult> {
  const urls = [
    "https://gateway-kw.kakao.com/decorator/v2/decorator/contents-home/ranking?tab=now",
    "https://gateway-kw.kakao.com/section/v1/pages/general-ranking",
  ];
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const data = await fetchJson<unknown>(url, {
        headers: {
          Accept: "application/json",
          Referer: "https://webtoon.kakao.com/",
        },
      });
      const items = kakaoRows(data);
      if (items.length) return result("kakao-webtoon", "카카오웹툰 랭킹", items.slice(0, 40));
      errors.push("empty");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "failed");
    }
  }
  return result("kakao-webtoon", "카카오웹툰 랭킹", [], errors.at(-1) ?? "empty");
}

function kakaoRows(node: unknown): ChartRow[] {
  const found: ChartRow[] = [];
  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object") return;
    const record = value as KakaoCard & Record<string, unknown>;
    const title =
      (typeof record.title === "string" && record.title) ||
      (typeof record.contentTitle === "string" && record.contentTitle) ||
      undefined;
    if (title && title.length >= 1 && title.length <= 40) {
      const thumb =
        typeof record.thumbnail === "string"
          ? record.thumbnail
          : typeof record.imageUrl === "string"
            ? record.imageUrl
            : undefined;
      found.push({
        rank: found.length + 1,
        title,
        subtitle: typeof record.author === "string" ? record.author : undefined,
        metric: typeof record.score === "number" ? record.score : undefined,
        imageUrl: thumb,
        tags: ["카카오웹툰"],
      });
    }
    Object.values(record).forEach(visit);
  };
  visit(node);
  return found.filter((row, index, list) => list.findIndex((item) => item.title === row.title) === index);
}

export async function fetchWebtoonSources(): Promise<SourceResult[]> {
  const [daily, weekly, kakao] = await Promise.all([
    fetchNaverWebtoonDaily(),
    fetchNaverWebtoonWeekly(),
    fetchKakaoWebtoonRanking(),
  ]);
  return [daily, weekly, kakao];
}

export function pickPrimaryWebtoon(sources: SourceResult[]): SourceResult | undefined {
  const order = ["naver-webtoon-daily", "naver-webtoon-weekly", "kakao-webtoon"];
  return order.map((id) => sources.find((item) => item.id === id && item.ok)).find(Boolean);
}
