/**
 * TV 시청률 / 방송 보드 가드 — 닐슨 프로그램만 남기고 유통·기업·이슈 잡음을 차단.
 */

import { isUnusableRankName } from "@/lib/boards/demographics";

/** Clear retail / corporate / finance tokens that Trends often misfiles as TV. */
const NON_TV_PROGRAM =
  /(백화점|마트|아울렛|쇼핑몰|편의점|이마트|롯데몰|갤러리아|신세계|현대백화점|롯데백화점|커머스|이커머스|플랫폼|에너빌리티|홀딩스|주식회사|\(주\)|㈜|그룹$|건설$|증권|보험|카드사?$|은행|중공업|항공사?$|캐스트파츠|부품|설비|코스피|코스닥|환율|주가|비트코인|상장|공모주)/i;

/** Headline / meta phrasing — not a programme title. */
const HEADLINE_SHAPED =
  /(트렌드는|전망$|속보$|종합$|이유는|관련주|수혜|급등|급락|실적|영업익|매출)/;

/** Latin industrial / parts-looking labels without a broadcaster cue. */
const LATIN_INDUSTRIAL =
  /\b(parts?|cast|precision|ultra|tech|system|energy|holding|corp|ltd|inc)\b/i;

const BROADCASTER_CUE =
  /KBS|MBC|SBS|JTBC|tvN|TVN|ENA|OCN|Mnet|EBS|YTN|채널A|TV조선|MBN|넷플릭스|티빙|웨이브|쿠팡플레이/i;

/**
 * True when `name` can sit on the TV 시청률 board (or cable `tv_show` tape).
 * Nielsen titles pass; Google Trends retail/corp noise fails.
 */
export function isLikelyTvProgramName(name: string): boolean {
  const cleaned = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/^\[[^\]]+\]\s*/, "").trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 40) return false;
  if (isUnusableRankName(cleaned)) return false;
  if (NON_TV_PROGRAM.test(cleaned)) return false;
  if (HEADLINE_SHAPED.test(cleaned)) return false;
  if (BROADCASTER_CUE.test(cleaned)) return true;
  if (/^[A-Za-z0-9][A-Za-z0-9\s\-_.]{0,28}$/.test(cleaned)) {
    if (LATIN_INDUSTRIAL.test(cleaned)) return false;
    if (/\s/.test(cleaned) && cleaned.length > 12) return false;
  }
  return true;
}
