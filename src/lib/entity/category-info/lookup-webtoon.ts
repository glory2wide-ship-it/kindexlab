import { fetchJson, fetchText } from "@/lib/ingestion/http";
import { decodeHtml, stripTags } from "@/lib/ingestion/parse";
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";

export type WebtoonLookup = {
  title: string;
  platform: string;
  author?: string;
  synopsis?: string;
  url?: string;
  scoreLabel?: string;
};

const NAVER_HEADERS = {
  Accept: "application/json,text/plain,*/*",
  Referer: "https://comic.naver.com/webtoon/weekday",
  Origin: "https://comic.naver.com",
};

const WEEKS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun", "dailyPlus"] as const;

type NaverTitle = {
  titleId?: number;
  titleName?: string;
  author?: string;
  starScore?: number;
  adult?: boolean;
};

function plain(raw?: string): string | undefined {
  if (!raw) return undefined;
  const text = decodeHtml(stripTags(raw)).replace(/\s+/g, " ").trim();
  return text || undefined;
}

function bestTitleMatch<T extends { title: string }>(
  rows: T[],
  name: string,
): T | undefined {
  const needle = normalizeName(name);
  if (!needle) return undefined;
  const scored = rows
    .map((row) => {
      const key = normalizeName(row.title);
      let score = 0;
      if (key === needle) score = 100;
      else if (key.includes(needle) || needle.includes(key)) score = 80;
      else if (namesOverlap(row.title, name)) score = 60;
      return { row, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.row;
}

async function fetchNaverWeekTitles(week: string): Promise<NaverTitle[]> {
  try {
    const data = await fetchJson<{
      titleList?: NaverTitle[];
      titleListMap?: Record<string, NaverTitle[]>;
    }>(`https://comic.naver.com/api/webtoon/titlelist/weekday?week=${week}&order=view`, {
      headers: NAVER_HEADERS,
    });
    if (Array.isArray(data.titleList)) return data.titleList;
    if (data.titleListMap) return Object.values(data.titleListMap).flat();
  } catch {
    /* soft */
  }
  return [];
}

async function naverSynopsis(titleId: number): Promise<string | undefined> {
  try {
    const html = await fetchText(
      `https://comic.naver.com/webtoon/list?titleId=${titleId}`,
      { headers: { Referer: "https://comic.naver.com/" } },
    );
    const og =
      html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/content=["']([^"']+)["']\s+property=["']og:description["']/i)?.[1];
    const meta = html.match(
      /name=["']description["']\s+content=["']([^"']+)["']/i,
    )?.[1];
    return plain(og || meta)?.slice(0, 220);
  } catch {
    return undefined;
  }
}

async function lookupNaver(name: string): Promise<WebtoonLookup | undefined> {
  const titles: NaverTitle[] = [];
  for (const week of WEEKS) {
    titles.push(...(await fetchNaverWeekTitles(week)));
  }
  const unique = new Map<number, NaverTitle>();
  for (const title of titles) {
    if (!title.titleId || title.adult || !title.titleName) continue;
    unique.set(title.titleId, title);
  }
  const matched = bestTitleMatch(
    [...unique.values()].map((t) => ({
      title: t.titleName!,
      raw: t,
    })),
    name,
  );
  if (!matched) return undefined;
  const raw = (matched as { title: string; raw: NaverTitle }).raw;
  const synopsis = raw.titleId ? await naverSynopsis(raw.titleId) : undefined;
  return {
    title: raw.titleName!,
    platform: "네이버웹툰",
    author: plain(raw.author),
    synopsis,
    url: raw.titleId
      ? `https://comic.naver.com/webtoon/list?titleId=${raw.titleId}`
      : undefined,
    scoreLabel:
      typeof raw.starScore === "number" && raw.starScore > 0
        ? `독자 별점 ${raw.starScore.toFixed(2)}`
        : undefined,
  };
}

async function lookupKakao(name: string): Promise<WebtoonLookup | undefined> {
  try {
    const html = await fetchText("https://page.kakao.com/menu/10", {
      headers: { Referer: "https://page.kakao.com/" },
    });
    const next = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i,
    )?.[1];
    if (!next) return undefined;
    const payload = JSON.parse(next) as unknown;
    const rows: Array<{ title: string; author?: string; url?: string }> = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      const obj = node as Record<string, unknown>;
      const title =
        (typeof obj.title === "string" && obj.title) ||
        (typeof obj.contentTitle === "string" && obj.contentTitle) ||
        undefined;
      if (title && title.length >= 2) {
        const authors = obj.authors;
        let author: string | undefined;
        if (typeof obj.author === "string") author = obj.author;
        else if (Array.isArray(authors)) {
          author = authors
            .map((a) =>
              typeof a === "string"
                ? a
                : typeof a === "object" && a && "name" in a
                  ? String((a as { name?: string }).name ?? "")
                  : "",
            )
            .filter(Boolean)
            .join(", ");
        }
        const id = obj.seriesId ?? obj.contentId ?? obj.id;
        rows.push({
          title,
          author: plain(author),
          url: id ? `https://page.kakao.com/content/${id}` : undefined,
        });
      }
      for (const value of Object.values(obj)) walk(value);
    };
    walk(payload);
    const hit = bestTitleMatch(rows, name);
    if (!hit) return undefined;
    return {
      title: hit.title,
      platform: "카카오페이지",
      author: hit.author,
      url: hit.url,
    };
  } catch {
    return undefined;
  }
}

/** Resolve webtoon platform/author/synopsis from Naver API (+ Kakao fallback). */
export async function lookupWebtoonFacts(
  name: string,
): Promise<WebtoonLookup | undefined> {
  const q = name.trim();
  if (!q) return undefined;
  const naver = await lookupNaver(q);
  if (naver) return naver;
  return lookupKakao(q);
}
