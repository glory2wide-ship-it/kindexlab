import { kstDateString } from "@/lib/briefing/dates";
import { fetchFormJson, fetchJson, fetchText, nowIso } from "@/lib/ingestion/http";
import { normalizeName } from "@/lib/ingestion/names";
import { parseNumber, stripTags } from "@/lib/ingestion/parse";
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

function isoWeek(date = new Date()): { year: string; week: string; month: string } {
  const kst = kstDateString(date);
  const [year, month, day] = kst.split("-").map(Number);
  const utc = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  const thursday = new Date(utc);
  thursday.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return {
    year: String(thursday.getUTCFullYear()),
    week: String(week).padStart(2, "0"),
    month: String(month).padStart(2, "0"),
  };
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  const lower = Object.fromEntries(Object.entries(record).map(([k, v]) => [k.toLowerCase(), v]));
  for (const key of keys) {
    const value = lower[key.toLowerCase()];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function asRowsFromUnknown(data: unknown): ChartRow[] {
  const found: ChartRow[] = [];
  const visit = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      if (node.length > 0 && typeof node[0] === "object") {
        const parsed = node
          .map((item, index) => rowFromRecord(item as Record<string, unknown>, index))
          .filter((item): item is ChartRow => Boolean(item));
        if (parsed.length >= 3) {
          found.push(...parsed);
          return;
        }
      }
      node.forEach(visit);
      return;
    }
    if (typeof node === "object") Object.values(node as Record<string, unknown>).forEach(visit);
  };
  visit(data);
  return found.slice(0, 50);
}

function rowFromRecord(record: Record<string, unknown>, index: number): ChartRow | undefined {
  const title = pickString(record, ["TITLE", "title", "SONG", "song", "ALBUM", "album", "name"]);
  const artist = pickString(record, ["ARTIST", "artist", "SINGER", "singer", "artistName"]);
  if (!title) return undefined;
  const rank = parseNumber(pickString(record, ["RANK", "rank", "ranking", "NO", "no"])) ?? index + 1;
  const previous =
    parseNumber(pickString(record, ["PRE_RANK", "preRank", "previousRank", "LAST_RANK"])) ??
    (parseNumber(pickString(record, ["RankChange", "rankChange"])) != null
      ? rank + (parseNumber(pickString(record, ["RankChange", "rankChange"])) ?? 0)
      : undefined);
  return {
    rank,
    previousRank: previous,
    title,
    subtitle: artist,
    tags: ["써클차트"],
  };
}

export async function fetchAppleMusicKr(): Promise<SourceResult> {
  try {
    const data = await fetchJson<{ feed?: { results?: { name: string; artistName: string }[] } }>(
      "https://rss.applemarketingtools.com/api/v2/kr/music/most-played/50/songs.json",
    );
    const items = (data.feed?.results ?? []).map((row, index) => ({
      rank: index + 1,
      title: row.name,
      subtitle: row.artistName,
      tags: ["Apple Music KR"],
    }));
    return result("apple-music", "Apple Music 한국 차트", items);
  } catch (error) {
    return result("apple-music", "Apple Music 한국 차트", [], error instanceof Error ? error.message : "failed");
  }
}

export async function fetchItunesKr(): Promise<SourceResult> {
  try {
    const data = await fetchJson<{
      feed?: { entry?: { "im:name": { label: string }; "im:artist": { label: string } }[] };
    }>("https://itunes.apple.com/kr/rss/topsongs/limit=50/json");
    const items = (data.feed?.entry ?? []).map((row, index) => ({
      rank: index + 1,
      title: row["im:name"]?.label,
      subtitle: row["im:artist"]?.label,
      tags: ["iTunes KR"],
    }));
    return result("itunes", "iTunes 한국 Top Songs", items);
  } catch (error) {
    return result("itunes", "iTunes 한국 Top Songs", [], error instanceof Error ? error.message : "failed");
  }
}

export async function fetchCircleDigital(): Promise<SourceResult> {
  const { year, week, month } = isoWeek();
  const payloads = [
    { nationGbn: "T", serviceGbn: "ALL", termGbn: "week", hitYear: year, targetTime: week, yearTime: "3" },
    { nationGbn: "T", serviceGbn: "ALL", termGbn: "week", hitYear: year, targetTime: String(Math.max(1, Number(week) - 1)).padStart(2, "0"), yearTime: "3" },
    { nationGbn: "T", serviceGbn: "ALL", termGbn: "month", hitYear: year, targetTime: month, yearTime: "3" },
  ];
  const errors: string[] = [];
  for (const body of payloads) {
    try {
      const jsonPosted = await fetchJson<unknown>("https://circlechart.kr/data/api/chart/onoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const fromJson = asRowsFromUnknown(jsonPosted);
      if (fromJson.length) return result("circle", "써클차트 디지털", fromJson);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "json post failed");
    }
    try {
      const data = await fetchFormJson<unknown>("https://circlechart.kr/data/api/chart/onoff", body);
      const items = asRowsFromUnknown(data);
      if (items.length) return result("circle", "써클차트 디지털", items);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "failed");
    }
  }
  return result("circle", "써클차트 디지털", [], errors.at(-1) ?? "empty");
}

export async function fetchBugsRealtime(): Promise<SourceResult> {
  try {
    const html = await fetchText("https://music.bugs.co.kr/chart/track/realtime/total");
    const items: ChartRow[] = [];
    const rowRe =
      /<tr[^>]*>([\s\S]*?ranking[\s\S]*?<strong>(\d+)<\/strong>[\s\S]*?class="title"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="artist"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?)<\/tr>/gi;
    let match: RegExpExecArray | null;
    while ((match = rowRe.exec(html))) {
      items.push({
        rank: Number(match[2]),
        title: stripTags(match[3] ?? ""),
        subtitle: stripTags(match[4] ?? ""),
        tags: ["벅스 실시간"],
      });
    }
    if (!items.length) {
      const titles = [...html.matchAll(/<p class="title">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => stripTags(m[1] ?? ""));
      const artists = [...html.matchAll(/<p class="artist">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => stripTags(m[1] ?? ""));
      titles.forEach((title, index) => {
        if (title) {
          items.push({
            rank: index + 1,
            title,
            subtitle: artists[index],
            tags: ["벅스 실시간"],
          });
        }
      });
    }
    return result("bugs", "벅스 실시간 차트", items.slice(0, 50));
  } catch (error) {
    return result("bugs", "벅스 실시간 차트", [], error instanceof Error ? error.message : "failed");
  }
}

export async function fetchMelonChart(): Promise<SourceResult> {
  try {
    const html = await fetchText("https://www.melon.com/chart/index.htm", {
      headers: { Referer: "https://www.melon.com/" },
    });
    const items: ChartRow[] = [];
    const blocks = [...html.matchAll(/<tr[^>]*class="[^"]*lst(?:50|100)[^"]*"[\s\S]*?<\/tr>/gi)];
    for (const block of blocks) {
      const chunk = block[0];
      const rank = parseNumber(chunk.match(/<span class="rank">\s*(\d+)\s*<\/span>/i)?.[1]);
      const title = stripTags(chunk.match(/class="ellipsis rank01"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
      const artist = stripTags(chunk.match(/class="ellipsis rank02"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
      if (rank && title) {
        items.push({ rank, title, subtitle: artist, tags: ["멜론 차트"] });
      }
    }
    return result("melon", "멜론 차트", items.slice(0, 50));
  } catch (error) {
    return result("melon", "멜론 차트", [], error instanceof Error ? error.message : "failed");
  }
}

export async function fetchGenieChart(): Promise<SourceResult> {
  try {
    const html = await fetchText("https://www.genie.co.kr/chart/top200?ditc=D&rtm=Y&pg=1");
    const items: ChartRow[] = [];
    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of rows) {
      const chunk = row[1] ?? "";
      const title = stripTags(chunk.match(/class="title ellipsis"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
      const artist = stripTags(chunk.match(/class="artist ellipsis"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
      const rank = parseNumber(stripTags(chunk.match(/class="number">([\s\S]*?)</i)?.[1] ?? ""));
      if (title && rank) {
        items.push({ rank, title, subtitle: artist, tags: ["지니 차트"] });
      }
    }
    return result("genie", "지니 TOP200", items.slice(0, 50));
  } catch (error) {
    return result("genie", "지니 TOP200", [], error instanceof Error ? error.message : "failed");
  }
}

/** Spotify Korea daily chart via kworb (stable HTML mirror of Spotify Charts). */
export async function fetchSpotifyKr(): Promise<SourceResult> {
  try {
    const html = await fetchText("https://kworb.net/spotify/country/kr_daily.html");
    const items: ChartRow[] = [];
    const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
    for (const row of rows) {
      const chunk = row[1] ?? "";
      const cells = [...chunk.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1] ?? ""));
      if (cells.length < 3) continue;
      const rank = parseNumber(cells[0]);
      const artist = cells[1]?.trim();
      const title = cells[2]?.trim();
      if (!rank || !title || rank > 50) continue;
      items.push({
        rank,
        title,
        subtitle: artist,
        tags: ["Spotify KR"],
        metric: Math.max(1, 51 - rank),
      });
    }
    return result("spotify-kr", "Spotify 한국 차트", items.slice(0, 50));
  } catch (error) {
    return result("spotify-kr", "Spotify 한국 차트", [], error instanceof Error ? error.message : "failed");
  }
}

/** YouTube Music / YouTube Korea daily chart (kworb insights). */
export async function fetchYoutubeMusicKr(): Promise<SourceResult> {
  try {
    const html = await fetchText("https://kworb.net/youtube/insights/kr_daily.html");
    const items: ChartRow[] = [];
    const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
    for (const row of rows) {
      const chunk = row[1] ?? "";
      const cells = [...chunk.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1] ?? ""));
      if (cells.length < 2) continue;
      const rank = parseNumber(cells[0]);
      // Layout varies: often rank | video title | artist | views
      const title = (cells[1] ?? "").trim();
      const artist = (cells[2] ?? "").trim();
      if (!rank || !title || rank > 50 || /^(pos|rank|#)$/i.test(title)) continue;
      items.push({
        rank,
        title,
        subtitle: artist && !/^\d/.test(artist) ? artist : undefined,
        tags: ["YouTube Music KR"],
        metric: Math.max(1, 51 - rank),
      });
    }
    return result("youtube-music", "유튜브 뮤직 한국 차트", items.slice(0, 50));
  } catch (error) {
    return result(
      "youtube-music",
      "유튜브 뮤직 한국 차트",
      [],
      error instanceof Error ? error.message : "failed",
    );
  }
}

export async function fetchMusicSources(): Promise<SourceResult[]> {
  return Promise.all([
    fetchMelonChart(),
    fetchGenieChart(),
    fetchBugsRealtime(),
    fetchSpotifyKr(),
    fetchYoutubeMusicKr(),
    fetchAppleMusicKr(),
    fetchItunesKr(),
    fetchCircleDigital(),
  ]);
}

const MUSIC_SOURCE_WEIGHT: Record<string, number> = {
  melon: 3,
  genie: 3,
  bugs: 2,
  "spotify-kr": 2.5,
  "youtube-music": 2.5,
  "apple-music": 1.5,
  circle: 2,
  itunes: 1,
};

function musicKey(row: ChartRow): string {
  return normalizeName(`${row.title}|${row.subtitle ?? ""}`) || normalizeName(row.title);
}

/**
 * Composite 음원 랭킹지수: Melon / Genie / Bugs / Spotify / YouTube Music / …
 * Weighted Borda count across successful chart pulls.
 */
export function composeMusicChart(sources: SourceResult[]): ChartRow[] {
  const charts = sources.filter((item) => item.ok && MUSIC_SOURCE_WEIGHT[item.id]);
  if (!charts.length) return [];

  type Acc = {
    title: string;
    subtitle?: string;
    tags: string[];
    points: number;
    bestRank: number;
    sources: number;
  };
  const map = new Map<string, Acc>();

  for (const chart of charts) {
    const weight = MUSIC_SOURCE_WEIGHT[chart.id] ?? 1;
    for (const row of chart.items.slice(0, 50)) {
      const key = musicKey(row);
      if (!key) continue;
      const points = weight * Math.max(1, 51 - row.rank);
      const current = map.get(key);
      if (!current) {
        map.set(key, {
          title: row.title,
          subtitle: row.subtitle,
          tags: [...(row.tags ?? [])],
          points,
          bestRank: row.rank,
          sources: 1,
        });
      } else {
        current.points += points;
        current.bestRank = Math.min(current.bestRank, row.rank);
        current.sources += 1;
        current.tags = [...new Set([...current.tags, ...(row.tags ?? [])])];
        if (!current.subtitle && row.subtitle) current.subtitle = row.subtitle;
        // Prefer Melon/Genie title when available.
        if (chart.id === "melon" || chart.id === "genie") {
          current.title = row.title;
          if (row.subtitle) current.subtitle = row.subtitle;
        }
      }
    }
  }

  return [...map.values()]
    .sort((a, b) => b.points - a.points || a.bestRank - b.bestRank || b.sources - a.sources)
    .slice(0, 50)
    .map((row, index) => ({
      rank: index + 1,
      title: row.title,
      subtitle: row.subtitle,
      metric: Math.round(row.points * 10),
      tags: [...new Set([...row.tags, "음원 랭킹지수", `소스${row.sources}`])],
    }));
}
export function pickPrimaryMusic(sources: SourceResult[]): SourceResult | undefined {
  const composed = composeMusicChart(sources);
  if (composed.length) {
    return {
      id: "music-composite",
      label: "음원 랭킹지수(복합)",
      ok: true,
      count: composed.length,
      fetchedAt: nowIso(),
      items: composed,
    };
  }
  const order = ["melon", "genie", "bugs", "spotify-kr", "youtube-music", "apple-music", "circle", "itunes"];
  return order.map((id) => sources.find((item) => item.id === id && item.ok)).find(Boolean);
}
