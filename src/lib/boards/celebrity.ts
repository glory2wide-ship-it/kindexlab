/**
 * Celebrity / 스타 board guards — keep person names, drop company·drama·media noise.
 */

import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import type { BoardRankEntry } from "@/lib/boards/types";

const COMPANY_NOISE =
  /(건설|엔터테인먼트|entertainment|홀딩스|그룹|은행|증권|카드|보험|전자|중공업|자동차|항공|통신|제약|바이오|카페|아파트|래미안|힐스테이트|아이파크|주식회사|공사|공단|산업|케미칼|케미컬|해운|물산|제철|시멘트|대우|현대건설|삼성물산|엘지|LG\b|SK\b|포스코|한화|롯데건설|\binc\b|\bltd\b|jyp|sm\b|hybe|yg\b)/i;

const DRAMA_OR_TITLE_NOISE =
  /(이\s*온다|시즌|에피소드|드라마|영화|개봉|예고편|공식\s*티저|ost\b|뮤비|mv\b|대\s*페예노르트|대\s*레알|대\s*레즈|다저스|양키스|MLB|KBO|사관학교|육군|해군|공군|대학교|고등학교)/i;

/** Press / broadcaster / portal brands are never celebrities. */
const MEDIA_OUTLET_NOISE =
  /(일보|신문|방송|뉴스|언론|미디어|통신사|기자단|연합뉴스|뉴시스|뉴스1|오마이뉴스|노컷뉴스|프레시안|한겨레|경향|매경|한경|이데일리|머니투데이|파이낸셜뉴스|서울경제|아시아경제|헤럴드경제|SBS\s*뉴스|MBC\s*뉴스|KBS\s*뉴스|JTBC\s*뉴스|YTN|채널A|TV조선)/i;

const EXACT_MEDIA_OUTLETS = new Set(
  [
    "중앙일보",
    "조선일보",
    "동아일보",
    "한겨레",
    "경향신문",
    "한국일보",
    "서울신문",
    "문화일보",
    "세계일보",
    "국민일보",
    "매일경제",
    "한국경제",
    "머니투데이",
    "이데일리",
    "연합뉴스",
    "뉴시스",
    "뉴스1",
    "오마이뉴스",
  ].map((s) => s.replace(/\s+/g, "").toLowerCase()),
);

const NON_PERSON_TOKENS =
  /^(ppi|iphone|애플|바르셀로나|카페|도둑|방아쇠|사랑|이유|오늘|속보|종합|공개|부모|학대|구금|마취|맞춤형복지|복지|정책|지원금|대출|금리|환율|주가|코스피|코스닥)$/i;

/** Institutional / policy compound nouns that Trends misfiles as people. */
const NON_PERSON_COMPOUND =
  /(복지|지원금|정책|대출|금리|공매도|펀드|예산|세금|연금|보험료|부동산|아파트|청약)$/;

/**
 * Incident / crime / disaster headlines Trends often dumps onto the 스타 board
 * (e.g. "부산 추락사"). Never treat these as celebrity names.
 */
const INCIDENT_OR_NEWS_NOISE =
  /(추락|추락사|사망|살해|살인|사건|사고|화재|참사|실종|폭행|체포|구속|폭발|붕괴|익사|교통사고|범죄|용의자|피의자|피해자|시신|부검|경찰|검찰)/;

/** Hangul person-ish: 2–6 syllables, optional English stage name. */
export function isLikelyCelebrityName(name: string): boolean {
  const cleaned = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/^\[[^\]]+\]\s*/, "").trim();
  if (!cleaned || cleaned.length > 24) return false;
  const compact = cleaned.replace(/\s+/g, "").toLowerCase();
  if (EXACT_MEDIA_OUTLETS.has(compact)) return false;
  if (COMPANY_NOISE.test(cleaned) || DRAMA_OR_TITLE_NOISE.test(cleaned)) return false;
  if (MEDIA_OUTLET_NOISE.test(cleaned)) return false;
  if (INCIDENT_OR_NEWS_NOISE.test(cleaned)) return false;
  if (NON_PERSON_TOKENS.test(cleaned.replace(/\s+/g, ""))) return false;
  if (NON_PERSON_COMPOUND.test(cleaned.replace(/\s+/g, ""))) return false;
  if (/\d{2,}/.test(cleaned)) return false;
  // Sports matchup "A 대 B" is never a celebrity.
  if (/\s대\s/.test(cleaned) || /대[가-힣]{2,}/.test(cleaned.replace(/\s+/g, ""))) {
    if (/(다저스|레즈|양키스|자이언츠|레알|바르사|맨유|토트넘|야구|축구)/i.test(cleaned)) {
      return false;
    }
  }
  // Institution / school endings.
  if (/(사관학교|학교|대학교|연구소|공사|공단)$/.test(cleaned)) return false;
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
