/**
 * Hit-song title validation + extraction.
 *
 * News-corpus fallback used to scrape agency/news fragments
 * (e.g. "정보 빅 히트 뮤직 막내아이돌 마" from HYBE/빅히트 copy) into
 * "최근 히트곡" chips. Keep Melon / catalog / music_chart nameEn links
 * first; never surface junk titles.
 */
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import type { RankingEntity } from "@/lib/types";

/** Agency / news / meta fragments that must never appear as song titles. */
const HIT_SONG_JUNK_RE =
  /빅\s*히트|HYBE|YG\s*엔터|JYP|소속사|기획사|엔터테인먼트|\b엔터\b|레이블|막내아이돌|아이돌\s*그룹|데뷔일|데뷔작|정보\s*빅|뮤직\s*막내|멤버\s*구성|팬덤|소속\s*정보|아티스트\s*정보|관련\s*검색|굿즈|앨범\s*정보/i;

const HIT_SONG_META_ONLY_RE =
  /^(소속|정보|데뷔|그룹|멤버|직업|활동|가수|아티스트|뮤직|음악|차트|순위|발매|공개)$/i;

export function isPlausibleHitSongTitle(
  raw: string,
  artistName?: string,
): boolean {
  const song = raw.replace(/\s+/g, " ").trim();
  if (song.length < 1 || song.length > 48) return false;
  if (HIT_SONG_JUNK_RE.test(song)) return false;
  if (HIT_SONG_META_ONLY_RE.test(song)) return false;
  // News lede scraps tend to be long Hangul phrases with many spaces.
  const hangulTokens = song.split(/\s+/).filter((t) => /[가-힣]{2,}/.test(t));
  if (hangulTokens.length >= 4 && !/[A-Za-z'’]{2,}/.test(song)) return false;
  if (artistName && namesOverlap(song, artistName) && song.length <= artistName.length + 2) {
    return false;
  }
  // Must look like a title, not a sentence fragment.
  if (/[.!?…]$/.test(song) && song.length > 28) return false;
  if (/^(그리고|하지만|또한|오늘|최근|국내|해외)\b/.test(song)) return false;
  return true;
}

export function sanitizeHitSongTitles(
  titles: string[],
  artistName?: string,
  limit = 5,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of titles) {
    const song = raw.replace(/\s+/g, " ").trim();
    if (!song || !isPlausibleHitSongTitle(song, artistName)) continue;
    const key = normalizeName(song);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(song);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Extract candidate hit songs from a news/web corpus.
 * Prefer quoted titles; unquoted "히트곡:" captures must still pass validation.
 */
export function extractHitSongs(text: string, name: string): string[] {
  const songs = new Set<string>();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    // Quoted titles near release language — highest confidence.
    /['"‘“]([^'"’”]{2,40})['"’”]\s*(?:공개|발매|차트|히트|신곡)/g,
    // "Artist의 히트곡: Title"
    new RegExp(
      `${escaped}\\s*(?:의)?\\s*(?:히트곡|대표곡|신곡|타이틀(?:곡)?)\\s*[:\\s]*['"‘“]?([^'"’”\\n·|,/]{2,40})`,
      "g",
    ),
    // Generic "히트곡: Title" — keep short; validation drops agency scraps.
    /(?:히트곡|대표곡|타이틀곡|신곡)\s*[:\s]*['"‘“]?([^'"’”\n·|,/]{2,40})/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1]?.replace(/\s+/g, " ").trim();
      if (!raw) continue;
      // Split accidental multi-title captures.
      for (const part of raw.split(/\s*[·|/]\s*/)) {
        const song = part.replace(/^[\s:：\-–]+|[\s:：\-–]+$/g, "").trim();
        if (!isPlausibleHitSongTitle(song, name)) continue;
        songs.add(song);
        if (songs.size >= 5) return [...songs];
      }
    }
  }
  return [...songs];
}

/** Music-chart rows whose nameEn points at this artist. */
export function hitSongsFromMusicChartPeers(
  artistName: string,
  peers: ReadonlyArray<Pick<RankingEntity, "name" | "nameEn" | "type">>,
  limit = 5,
): string[] {
  const titles: string[] = [];
  for (const peer of peers) {
    if (peer.type !== "music_chart") continue;
    const credited = peer.nameEn?.trim();
    if (!credited) continue;
    if (!namesOverlap(credited, artistName)) continue;
    titles.push(peer.name);
  }
  return sanitizeHitSongTitles(titles, artistName, limit);
}

/** First non-empty sanitized candidate list. */
export function pickHitSongs(
  artistName: string,
  ...candidates: string[][]
): string[] {
  for (const list of candidates) {
    const clean = sanitizeHitSongTitles(list, artistName);
    if (clean.length) return clean;
  }
  return [];
}
