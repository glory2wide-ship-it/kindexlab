/**
 * Movie / 박스오피스 title guards — keep film titles, drop headline scraps & scrape chrome.
 */

import { isUnusableRankName } from "@/lib/boards/demographics";

/** Headline / box-office meta phrasing that is not a film title. */
const MOVIE_HEADLINE_NOISE =
  /(억\s*벌|억\s*원|관객|흥행|돌파|개봉일|예매율|박스\s*오피스|첫\s*주말|누적|기록했다|벌었다|벌며|올렸다|찍었다|속보|종합$|이유는|관련주)/i;

/** Portal UI empty-states, errors, domains, and ads scraped as "titles". */
const MOVIE_SCRAPE_CHROME =
  /(선택하신\s*조건|해당하는\s*영화가\s*없습니다|다른\s*조건을\s*선택|일시적인\s*오류|오류가\s*발생|서비스\s*점검|접속\s*장애|페이지를\s*찾을\s*수|네이버\s*인플루언서|인플루언서|네이버\s*웨일|웨일에서\s*빠른|빠른\s*인터넷을\s*만나|광고|스폰서|쿠폰|다운로드|설치하세요|만나보세요)/i;

const MOVIE_DOMAIN_OR_URL =
  /(\.[a-z]{2,6}\b|https?:\/\/|www\.|\.go\.kr|\.co\.kr|\.com|\.net|\.org)/i;

const EXACT_MOVIE_NOISE = new Set(
  [
    "마블선배",
    "마블 선배",
    "첫주말44억벌었다",
    "첫 주말, 44억 벌었다",
    "첫주말,44억벌었다",
    "인플루언서",
    "네이버 인플루언서",
    "일시적인 오류가 발생했습니다",
    "일시적인오류가발생했습니다",
    "gimje.go.kr",
  ].map((s) => s.replace(/\s+/g, "").toLowerCase()),
);

/**
 * True when `name` can sit on the 영화 / boxoffice board.
 */
export function isLikelyMovieTitle(name: string): boolean {
  const cleaned = name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/^\[[^\]]+\]\s*/, "")
    .trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 40) return false;
  if (isUnusableRankName(cleaned)) return false;
  const compact = cleaned.replace(/\s+/g, "").toLowerCase();
  if (EXACT_MOVIE_NOISE.has(compact)) return false;
  if (MOVIE_HEADLINE_NOISE.test(cleaned)) return false;
  if (MOVIE_SCRAPE_CHROME.test(cleaned)) return false;
  if (MOVIE_DOMAIN_OR_URL.test(cleaned)) return false;
  // Sentence-like marketing / UI copy (ends with 요/다/세요 or has many spaces).
  if (/[다요임]$/.test(cleaned) && (cleaned.length >= 16 || /\s/.test(cleaned))) {
    if (/(없습니다|주세요|보세요|했습니다|됩니다|입니다)/.test(cleaned)) return false;
  }
  // Comma-heavy news ledes are almost never titles.
  if (/,/.test(cleaned) && cleaned.length > 12) return false;
  // Pure single generic nouns that Trends misfiles.
  if (/^(영화|드라마|예고편|예매|상영|개봉|인플루언서)$/.test(cleaned)) return false;
  return true;
}
