/**
 * TV 시청률 / 방송 보드 가드 — 닐슨 프로그램만 남기고 유통·기업·이슈·서비스 잡음을 차단.
 */

import { isUnusableRankName } from "@/lib/boards/demographics";

/** Clear retail / corporate / finance tokens that Trends often misfiles as TV. */
const NON_TV_PROGRAM =
  /(백화점|마트|아울렛|쇼핑몰|편의점|이마트|롯데몰|갤러리아|신세계|현대백화점|롯데백화점|커머스|이커머스|플랫폼|에너빌리티|에너빌리티|홀딩스|주식회사|\(주\)|㈜|그룹$|건설$|증권|보험|카드사?$|은행|중공업|항공사?$|캐스트파츠|부품|설비|코스피|코스닥|환율|주가|비트코인|상장|공모주|두산|삼성전자|현대차|SK하이닉스|LG에너지|카카오뱅크|네이버)/i;

/** Headline / meta / ops phrasing — not a programme title. */
const HEADLINE_SHAPED =
  /(트렌드는|전망$|속보$|종합$|이유는|관련주|수혜|급등|급락|실적|영업익|매출|중단$|점검중|접속장애|서비스\s*장애)/;

/** Service / AS / festival / diet-ad / YouTube-ops noise often scraped into TV boards. */
const SERVICE_EVENT_NOISE =
  /(유튜브\s*중단|유튜브\s*장애|요요\s*없는|요요없는|예비\s*글로벌|글로벌\s*축제|축제$|페스티벌|뮤직\s*페스티벌|방송의\s*날|수발|A\s*\/\s*S|A\/S|에이에스|애프터\s*서비스|AS\b|고객센터|콜센터|수리|교체|보증|다이어트|살빼|비만|클리닉|병원$|의원$|약국$|보험료|대출|금리|공매도|펀드|ETF|채권)/i;

/** Exact / near-exact junk titles observed on the TV heatmap. */
const EXACT_TV_NOISE = new Set(
  [
    "유튜브 중단",
    "유튜브중단",
    "요요없는",
    "요요 없는",
    "두산에너빌리티",
    "두산 에너빌리티",
    "예비글로벌축제",
    "예비 글로벌축제",
    "예비 글로벌 축제",
    "수발 a/s",
    "수발 as",
    "수발 AS",
    "수발A/S",
    "오피셜",
    "군백기",
    "거대한 시작",
    "방송의날",
    "방송의 날",
    "서리풀 뮤직페스티벌",
    "서리풀뮤직페스티벌",
  ].map((s) => s.replace(/\s+/g, "").toLowerCase()),
);

/** Latin industrial / parts-looking labels without a broadcaster cue. */
const LATIN_INDUSTRIAL =
  /\b(parts?|cast|precision|ultra|tech|system|energy|holding|corp|ltd|inc|as)\b/i;

const BROADCASTER_CUE =
  /KBS|MBC|SBS|JTBC|tvN|TVN|ENA|OCN|Mnet|EBS|YTN|채널A|TV조선|MBN|넷플릭스|티빙|웨이브|쿠팡플레이/i;

function compactNoiseKey(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

/**
 * True when `name` can sit on the TV 시청률 board (or cable `tv_show` tape).
 * Nielsen titles pass; Google Trends retail/corp/service noise fails.
 */
export function isLikelyTvProgramName(name: string): boolean {
  const cleaned = name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/^\[[^\]]+\]\s*/, "")
    .trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 40) return false;
  if (isUnusableRankName(cleaned)) return false;
  if (EXACT_TV_NOISE.has(compactNoiseKey(cleaned))) return false;
  if (NON_TV_PROGRAM.test(cleaned)) return false;
  if (HEADLINE_SHAPED.test(cleaned)) return false;
  if (SERVICE_EVENT_NOISE.test(cleaned)) return false;
  if (BROADCASTER_CUE.test(cleaned)) return true;
  if (/^[A-Za-z0-9][A-Za-z0-9\s\-_.\/]{0,28}$/.test(cleaned)) {
    if (LATIN_INDUSTRIAL.test(cleaned)) return false;
    if (/\s/.test(cleaned) && cleaned.length > 12) return false;
  }
  return true;
}
