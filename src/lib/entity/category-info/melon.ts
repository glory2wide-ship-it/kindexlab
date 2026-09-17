/**
 * Melon public chart + keyword search for 음원 detail 맞춤 정보.
 * Music-board entities are songs (`name` = title, `nameEn` = artist).
 */

import { fetchText } from "@/lib/ingestion/http";
import { stripTags } from "@/lib/ingestion/parse";

export type MelonSongHit = {
  songId: string;
  songName: string;
  artistName: string;
  albumName?: string;
  /** 1–100 when found on Melon TOP100; undefined if search-only. */
  chartRank?: number;
  href: string;
  source: "chart" | "search";
};

type MelonChartSong = {
  curRank?: number | string;
  songId?: number | string;
  songName?: string;
  artistNames?: string;
  albumName?: string;
};

type MelonKeywordSong = {
  SONGID?: string;
  SONGNAME?: string;
  ARTISTNAME?: string;
  ALBUMNAME?: string;
};

const CHART_URL = "https://www.melon.com/chart/index.json";
const KEYWORD_URL = "https://www.melon.com/search/keyword/index.json";

const MELON_HEADERS = {
  Referer: "https://www.melon.com/",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "X-Requested-With": "XMLHttpRequest",
} as const;

function cleanText(value: string): string {
  return stripTags(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeMusicKey(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

/** Strip `RESCENE (리센느)` → compare against both halves. */
export function artistMatchKeys(artist?: string): string[] {
  if (!artist?.trim()) return [];
  const raw = cleanText(artist);
  const keys = new Set<string>();
  const full = normalizeMusicKey(raw);
  if (full) keys.add(full);
  for (const part of raw.split(/[\/,&]| feat\.? | featuring /i)) {
    const k = normalizeMusicKey(part);
    if (k.length >= 2) keys.add(k);
  }
  const paren = raw.match(/\(([^)]+)\)/);
  if (paren?.[1]) {
    const k = normalizeMusicKey(paren[1]);
    if (k.length >= 2) keys.add(k);
  }
  return [...keys];
}

function artistsOverlap(left: string, rightKeys: string[]): boolean {
  if (!rightKeys.length) return true;
  const leftKeys = artistMatchKeys(left);
  if (!leftKeys.length) return false;
  return leftKeys.some((a) =>
    rightKeys.some((b) => a === b || a.includes(b) || b.includes(a)),
  );
}

/** Exact / near-exact title only — never let "BAD" match "BAD TIMES". */
function titlesOverlap(songTitle: string, candidate: string): boolean {
  const a = normalizeMusicKey(songTitle);
  const b = normalizeMusicKey(candidate);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < 4) return false;
  if (!longer.startsWith(shorter)) return false;
  const rest = longer.slice(shorter.length);
  return !rest || /^(remix|remaster|inst|live|explicit|ver|version|mix|edit|feat).*/i.test(rest);
}

function songHref(songId: string): string {
  return `https://www.melon.com/song/detail.htm?songId=${encodeURIComponent(songId)}`;
}

let chartCache: { at: number; songs: MelonSongHit[] } | null = null;
const CHART_TTL_MS = 30 * 60 * 1000;

async function loadMelonTop100(): Promise<MelonSongHit[]> {
  if (chartCache && Date.now() - chartCache.at < CHART_TTL_MS) {
    return chartCache.songs;
  }
  try {
    const raw = await fetchText(CHART_URL, {
      headers: MELON_HEADERS,
      next: { revalidate: 1800 },
    });
    const parsed = JSON.parse(raw) as { songList?: MelonChartSong[] };
    const songs: MelonSongHit[] = [];
    for (const row of parsed.songList ?? []) {
      const songId = String(row.songId ?? "").trim();
      const songName = cleanText(String(row.songName ?? ""));
      const artistName = cleanText(String(row.artistNames ?? ""));
      const rank = Number(row.curRank);
      if (!songId || !songName) continue;
      songs.push({
        songId,
        songName,
        artistName,
        albumName: cleanText(String(row.albumName ?? "")) || undefined,
        chartRank: Number.isFinite(rank) && rank > 0 ? rank : undefined,
        href: songHref(songId),
        source: "chart",
      });
    }
    chartCache = { at: Date.now(), songs };
    return songs;
  } catch {
    return chartCache?.songs ?? [];
  }
}

async function searchMelonKeyword(query: string): Promise<MelonSongHit[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const url = `${KEYWORD_URL}?query=${encodeURIComponent(q)}`;
    const raw = await fetchText(url, {
      headers: MELON_HEADERS,
      next: { revalidate: 1800 },
    });
    const parsed = JSON.parse(raw) as { SONGCONTENTS?: MelonKeywordSong[] };
    const out: MelonSongHit[] = [];
    for (const row of parsed.SONGCONTENTS ?? []) {
      const songId = String(row.SONGID ?? "").trim();
      const songName = cleanText(String(row.SONGNAME ?? ""));
      const artistName = cleanText(String(row.ARTISTNAME ?? ""));
      if (!songId || !songName) continue;
      out.push({
        songId,
        songName,
        artistName,
        albumName: cleanText(String(row.ALBUMNAME ?? "")) || undefined,
        href: songHref(songId),
        source: "search",
      });
    }
    return out;
  } catch {
    return [];
  }
}

function pickBest(
  candidates: MelonSongHit[],
  songTitle: string,
  artistKeys: string[],
  requireArtist: boolean,
): MelonSongHit | undefined {
  const titled = candidates.filter((c) => titlesOverlap(songTitle, c.songName));
  if (!titled.length) return undefined;
  const withArtist = artistKeys.length
    ? titled.filter((c) => artistsOverlap(c.artistName, artistKeys))
    : titled;
  const pool = withArtist.length ? withArtist : requireArtist && artistKeys.length ? [] : titled;
  if (!pool.length) return undefined;
  const ranked = pool.slice();
  ranked.sort((a, b) => {
    const aExact = normalizeMusicKey(a.songName) === normalizeMusicKey(songTitle) ? 0 : 1;
    const bExact = normalizeMusicKey(b.songName) === normalizeMusicKey(songTitle) ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const aArt = artistsOverlap(a.artistName, artistKeys) ? 0 : 1;
    const bArt = artistsOverlap(b.artistName, artistKeys) ? 0 : 1;
    if (aArt !== bArt) return aArt - bArt;
    return (a.chartRank ?? 999) - (b.chartRank ?? 999);
  });
  return ranked[0];
}

/**
 * Resolve a music-board song against Melon TOP100, then keyword search.
 * Always prefers artist (`nameEn`) when provided.
 */
export async function lookupMelonSong(
  songTitle: string,
  artistName?: string,
): Promise<MelonSongHit | undefined> {
  const title = cleanText(songTitle);
  if (!title) return undefined;
  const artistKeys = artistMatchKeys(artistName);
  const requireArtist = artistKeys.length > 0;

  const chart = await loadMelonTop100();
  const onChart = pickBest(chart, title, artistKeys, requireArtist);
  if (onChart?.chartRank) return onChart;

  const queries = [
    artistName ? `${title} ${artistName}` : "",
    title,
    artistName ?? "",
  ].filter(Boolean);
  const seen = new Set<string>();
  const searched: MelonSongHit[] = [];
  for (const q of queries) {
    for (const hit of await searchMelonKeyword(q)) {
      if (seen.has(hit.songId)) continue;
      seen.add(hit.songId);
      const chartRow = chart.find((c) => c.songId === hit.songId);
      searched.push(
        chartRow?.chartRank
          ? { ...hit, chartRank: chartRow.chartRank, source: "chart" }
          : hit,
      );
    }
  }

  return pickBest(searched, title, artistKeys, requireArtist) ?? onChart;
}

/** Artist-mode: Melon chart songs by this artist (for kpop/trot chips). */
export async function crawlMelonSongsForArtist(artistName: string): Promise<string[]> {
  const keys = artistMatchKeys(artistName);
  if (!keys.length) return [];
  const chart = await loadMelonTop100();
  const fromChart = chart
    .filter((s) => artistsOverlap(s.artistName, keys))
    .map((s) => s.songName);
  if (fromChart.length >= 3) return [...new Set(fromChart)].slice(0, 5);

  const searched = await searchMelonKeyword(artistName);
  const titles = searched
    .filter((s) => artistsOverlap(s.artistName, keys))
    .map((s) => s.songName);
  return [...new Set([...fromChart, ...titles])].slice(0, 5);
}
