/**
 * Grant / subsidy "신청 기간" extraction + validation.
 * Crawl corpora often contain checklist prose ("신청 기간, 접수 마감…") or
 * news headlines that end with "신청 기간" — those must never become the cell value.
 */

const PERIOD_DATE_HINT =
  /\d{2,4}\s*[.년/\-]|[‘'′]?\d{2}\s*\.\s*\d{1,2}|\d{1,2}\s*\.\s*\d{1,2}\s*[.~～\-]|만\s*\d{1,3}\s*세/;

const PERIOD_OPEN_HINT =
  /상시|연중|수시|매년|모집|마감|까지|부터|종료|신규\s*가입|영업일|예산\s*소진|접수\s*기관|별\s*상이|신청\s*가능|신청\s*중|회차|분기|학기|반기|정기\s*신청|기한\s*후/;

const PERIOD_REJECT =
  /가능할까|\?|KB\s*Think|조건,\s*신청|갈아타기|필\s*수\s*체크|준비물|구비\s*여부|소득금액증명|신분증|통장\s*사본|협약\s*은행별\s*신청처|https?:\/\/|#\w{2,}/i;

/** True when a candidate string is a believable 신청/접수 기간 cell. */
export function isPlausibleGrantPeriod(value?: string): boolean {
  if (!value?.trim()) return false;
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > 160) return false;
  // List / UI fragments: ", 접수 마감…" or "| 뉴스제목…"
  if (/^[,|·•|/]/.test(text)) return false;
  if (/^[|]\s/.test(text) || /\s\|\s/.test(text)) return false;
  if (PERIOD_REJECT.test(text)) return false;
  // Comma-led checklist after a false "신청 기간," capture
  if (/^(?:접수\s*마감|마감\s*시점|신청처|소득\s*증빙)/.test(text)) return false;
  if (PERIOD_DATE_HINT.test(text) || PERIOD_OPEN_HINT.test(text)) return true;
  return false;
}

/** Strip crawl noise then accept only plausible period strings. */
export function sanitizeGrantPeriod(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const cleaned = value
    .replace(/(?:^|\s)#[^\s#]{1,40}/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[|:·•\-\s]+/, "")
    .trim();
  if (!isPlausibleGrantPeriod(cleaned)) return undefined;
  return cleaned;
}

/**
 * Pull a period string from mixed crawl/API corpus.
 * Requires a real delimiter (colon) or a date-like token right after the label.
 */
export function extractGrantPeriod(corpus: string): string | undefined {
  if (!corpus?.trim()) return undefined;
  const patterns: RegExp[] = [
    // "신청 기간: 2025.1.1 ~ 2025.12.31" / "신청기간 ： 상시"
    /(?:신청|접수)\s*기간\s*[:：]\s*([^\n#|]{2,120})/,
    // Label then immediate date / 상시 (no colon) — still reject comma lists
    /(?:신청|접수)\s*기간\s+(?=[\d‘'′상시연중수시매년모집신규정기회차학기])([^\n#|,]{2,120})/,
    // Bare date ranges anywhere (last resort)
    /(\d{4}\s*[.년/\-]\s*\d{1,2}\s*[.월/\-]?\s*\d{0,2}\s*[.~～\-]\s*\d{2,4}\s*[.년/\-]\s*\d{1,2}\s*[.월/\-]?\s*\d{0,2})/,
  ];
  for (const pattern of patterns) {
    const hit = corpus.match(pattern);
    const raw = hit?.[1]?.replace(/\s+/g, " ").trim();
    const value = sanitizeGrantPeriod(raw);
    if (value) return value;
  }
  return undefined;
}
