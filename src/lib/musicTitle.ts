import { isTwoLineBracketHeatmap } from "@/lib/boards/culture-grants";
import type { RankingEntity } from "@/lib/types";
import { parseBracketLabel, parsePersonTag } from "@/lib/politics/labeled-rank";

const TITLE_ARTIST_SPLIT = /\s[-–—]\s/;

export function splitTrackName(name: string): { title: string; artist?: string } {
  const trimmed = name.trim();
  const parts = trimmed.split(TITLE_ARTIST_SPLIT);
  if (parts.length >= 2) {
    const title = parts[0]?.trim() ?? trimmed;
    const artist = parts.slice(1).join(" - ").trim();
    if (title && artist) return { title, artist };
  }

  const latinThenHangul = trimmed.match(
    /^([A-Za-z0-9][A-Za-z0-9 .'!?&+,-]*?)\s+([가-힣][가-힣A-Za-z0-9.&' ]{0,24})$/,
  );
  if (latinThenHangul?.[1] && latinThenHangul[2]) {
    return { title: latinThenHangul[1].trim(), artist: latinThenHangul[2].trim() };
  }

  const hangulThenLatin = trimmed.match(
    /^([가-힣][가-힣0-9 ]+?)\s+([A-Za-z][A-Za-z0-9 .&'+-]{1,28})$/,
  );
  if (hangulThenLatin?.[1] && hangulThenLatin[2]) {
    return { title: hangulThenLatin[1].trim(), artist: hangulThenLatin[2].trim() };
  }

  return { title: trimmed };
}

function isBoardLabel(value: string, entity: Pick<RankingEntity, "heatmapGroup" | "name">): boolean {
  const text = value.trim();
  if (!text) return true;
  if (text === entity.name) return true;
  if (entity.heatmapGroup && text === entity.heatmapGroup) return true;
  return /차트|랭킹|지수|화력|시세|보드/.test(text);
}

/** Song title + artist for music tiles. Labeled politics rows split org/subject. */
export function heatmapNameLines(entity: Pick<RankingEntity, "name" | "nameEn" | "type" | "heatmapGroup">): {
  title: string;
  artist?: string;
} {
  const bracket = parseBracketLabel(entity.name);
  if (bracket && isTwoLineBracketHeatmap(entity.heatmapGroup)) {
    return { title: bracket.subject, artist: bracket.org };
  }
  if (bracket && (entity.type === "local_policy" || entity.type === "subsidy")) {
    return { title: bracket.subject, artist: `[${bracket.org}]` };
  }
  const person = parsePersonTag(entity.name);
  if (person && entity.type === "political_pundit") {
    return { title: person.person, artist: person.tag };
  }

  const parsed = splitTrackName(entity.name);
  if (entity.type !== "music_chart") return parsed.title ? parsed : { title: entity.name };

  if (parsed.artist) return parsed;
  const fallback = entity.nameEn?.trim();
  if (fallback && !isBoardLabel(fallback, entity)) {
    return { title: entity.name, artist: fallback };
  }
  return { title: entity.name };
}
