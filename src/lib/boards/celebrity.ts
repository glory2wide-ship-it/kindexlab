/**
 * Celebrity / 스타 board guards — keep person names, drop company·drama·noise.
 */

import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import type { BoardRankEntry } from "@/lib/boards/types";

const COMPANY_NOISE =
  /(건설|엔터테인먼트|entertainment|홀딩스|그룹|은행|증권|카드|보험|전자|중공업|자동차|항공|통신|제약|바이오|카페|아파트|래미안|힐스테이트|아이파크|주식회사|공사|공단|산업|케미칼|케미컬|해운|물산|제철|시멘트|대우|현대건설|삼성물산|엘지|LG\b|SK\b|포스코|한화|롯데건설|\binc\b|\bltd\b|jyp|sm\b|hybe|yg\b)/i;

const DRAMA_OR_TITLE_NOISE =
  /(이\s*온다|시즌|에피소드|드라마|영화|개봉|예고편|공식\s*티저|ost\b|뮤비|mv\b|대\s*페예노르트|대\s*레알)/i;

const NON_PERSON_TOKENS =
  /^(ppi|iphone|애플|바르셀로나|카페|도둑|방아쇠|사랑|이유|오늘|속보|종합|공개)$/i;

/** Hangul person-ish: 2–6 syllables, optional English stage name. */
export function isLikelyCelebrityName(name: string): boolean {
  const cleaned = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/^\[[^\]]+\]\s*/, "").trim();
  if (!cleaned || cleaned.length > 24) return false;
  if (COMPANY_NOISE.test(cleaned) || DRAMA_OR_TITLE_NOISE.test(cleaned)) return false;
  if (NON_PERSON_TOKENS.test(cleaned.replace(/\s+/g, ""))) return false;
  if (/\d{2,}/.test(cleaned)) return false;
  // Company-shaped endings even when the stem is short (대우건설, ○○은행).
  if (/(건설|은행|증권|카드|보험|전자|중공업|홀딩스|물산|제철|케미칼|케미컬)$/.test(cleaned)) {
    return false;
  }
  // Pure English brand-like tokens (all caps / long ascii) are usually noise.
  if (/^[A-Za-z0-9 .&'-]{8,}$/.test(cleaned) && !/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/.test(cleaned)) {
    return false;
  }
  const hangul = cleaned.replace(/[^가-힣]/g, "");
  if (hangul.length >= 2 && hangul.length <= 6) return true;
  // Short Latin stage names (IU-style already Hangul; allow 2–3 token titles like "Karina")
  if (/^[A-Za-z][A-Za-z.'-]{1,14}$/.test(cleaned)) return true;
  return false;
}

/**
 * Prefer live celebrity rows that look like people; pad with board seeds.
 */
export function ensureCelebrityRanking(
  rows: BoardRankEntry[],
  seeds: readonly string[],
  limit = 30,
): BoardRankEntry[] {
  const usable = rows.filter((row) => isLikelyCelebrityName(row.name));
  const unique: BoardRankEntry[] = [];
  const seen = new Set<string>();
  for (const row of usable) {
    const key = normalizeName(row.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...row, name: row.name.trim() });
  }

  for (const seed of seeds) {
    if (unique.length >= limit) break;
    const key = normalizeName(seed);
    if (!key || seen.has(key)) continue;
    if (unique.some((row) => namesOverlap(row.name, seed))) continue;
    seen.add(key);
    unique.push({
      rank: unique.length + 1,
      name: seed,
      score: Math.max(40, 88 - unique.length * 1.4),
      changeRate: Number((Math.sin(unique.length * 1.7) * 3.2).toFixed(2)),
      note: "스타 시드",
    });
  }

  return unique.slice(0, limit).map((row, index) => ({ ...row, rank: index + 1 }));
}
