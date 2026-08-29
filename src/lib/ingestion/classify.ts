import type { TrafficCategory } from "@/lib/ingestion/channels";
import { matchPoliticsYoutubeSeed } from "@/lib/politics/youtube-seeds";
import type { EntityType } from "@/lib/types";

export interface SmartClassification {
  category: TrafficCategory;
  type: EntityType;
  /** The term that decided it, for the ingest log. */
  matched: string;
  strength: "strong" | "weak";
  /**
   * Where the term was found. Feed tags are broad genre labels ("예능",
   * "드라마") attached to entire source batches, so a tag match says almost
   * nothing about the individual row. Callers use this to require a title match
   * before making a destructive re-tag.
   */
  source: "text" | "tags";
}

/**
 * Terms that identify the category on their own.
 */
const POLITICS_STRONG = [
  "정치",
  "시사",
  "국회",
  "대통령",
  "여당",
  "야당",
  "평론",
  "청문회",
  "의원",
  "정당",
  "총선",
  "대선",
  "개헌",
  "탄핵",
  "국정감사",
];

const ENTERTAINMENT_STRONG = [
  "예능",
  "웹예능",
  "토크쇼",
  "인플루언서",
  "연예",
  "음원",
  "드라마",
  "영화",
  "핫이슈",
  "아이돌",
  "컴백",
  "예고편",
];

/**
 * Terms that appear in both worlds. "뉴스" sits in entertainment headlines as
 * often as political ones and "방송" covers everything broadcast, so on their
 * own they would mislabel most of the feed. They decide a row only when the
 * other category has no signal at all.
 */
const POLITICS_WEAK = ["뉴스", "보도", "논평"];
const ENTERTAINMENT_WEAK = ["방송", "출연", "무대", "공연"];

function firstMatch(haystack: string, terms: string[]): string | undefined {
  return terms.find((term) => haystack.includes(term));
}

/**
 * Re-tags a trend row from its own text rather than from whatever category the
 * upstream feed assigned. YouTube trending returns one undifferentiated list,
 * so without this every political talk show and variety clip lands in 숏폼.
 */
export function classifySmart(
  title: string,
  subtitle?: string,
  tags: string[] = [],
): SmartClassification | null {
  const text = `${title} ${subtitle ?? ""}`;
  const tagBlob = tags.join(" ");
  const seed = matchPoliticsYoutubeSeed(text);
  if (seed?.influencer) {
    return {
      category: "politics",
      type: "political_influencer",
      matched: seed.name,
      strength: "strong",
      source: "text",
    };
  }

  const politics =
    firstMatch(text, POLITICS_STRONG) ??
    firstMatch(tagBlob, POLITICS_STRONG) ??
    undefined;
  const entertainment =
    firstMatch(text, ENTERTAINMENT_STRONG) ??
    firstMatch(tagBlob, ENTERTAINMENT_STRONG) ??
    undefined;

  // A row naming both is nearly always political coverage that mentions a
  // celebrity, not the reverse, so politics takes the tie.
  if (politics) {
    const influencerCue = /유튜브|채널|라이브|시사 방송|뉴스공장|인플루언서|팟캐스트|라디오/.test(text);
    return {
      category: "politics",
      type: influencerCue ? "political_influencer" : "political_pundit",
      matched: politics,
      strength: "strong",
      source: text.includes(politics) ? "text" : "tags",
    };
  }
  if (entertainment) {
    return {
      category: "entertainment",
      type: "influencer",
      matched: entertainment,
      strength: "strong",
      source: text.includes(entertainment) ? "text" : "tags",
    };
  }

  const politicsWeak = firstMatch(text, POLITICS_WEAK) ?? firstMatch(tagBlob, POLITICS_WEAK);
  const entertainmentWeak =
    firstMatch(text, ENTERTAINMENT_WEAK) ?? firstMatch(tagBlob, ENTERTAINMENT_WEAK);
  if (politicsWeak && !entertainmentWeak) {
    return {
      category: "politics",
      type: "political_ratings",
      matched: politicsWeak,
      strength: "weak",
      source: text.includes(politicsWeak) ? "text" : "tags",
    };
  }
  if (entertainmentWeak && !politicsWeak) {
    return {
      category: "entertainment",
      type: "influencer",
      matched: entertainmentWeak,
      strength: "weak",
      source: text.includes(entertainmentWeak) ? "text" : "tags",
    };
  }

  return null;
}
