/**
 * Movie / 박스오피스 title guards — keep film titles, drop headline scraps.
 */

import { isUnusableRankName } from "@/lib/boards/demographics";

/** Headline / box-office meta phrasing that is not a film title. */
const MOVIE_HEADLINE_NOISE =
  /(억\s*벌|억\s*원|관객|흥행|돌파|개봉일|예매율|박스\s*오피스|첫\s*주말|누적|기록했다|벌었다|벌며|올렸다|찍었다|속보|종합$|이유는|관련주)/i;

const EXACT_MOVIE_NOISE = new Set(
  ["마블선배", "마블 선배", "첫주말44억벌었다", "첫 주말, 44억 벌었다", "첫주말,44억벌었다"].map((s) =>
    s.replace(/\s+/g, "").toLowerCase(),
  ),
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
  // Comma-heavy news ledes are almost never titles.
  if (/,/.test(cleaned) && cleaned.length > 12) return false;
  return true;
}
