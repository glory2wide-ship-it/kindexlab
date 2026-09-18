/**
 * Guard: grant "신청 기간" must reject news titles / prep-list fragments.
 *   npx tsx scripts/_check-grant-period.ts
 */
import assert from "node:assert/strict";
import {
  extractGrantPeriod,
  isPlausibleGrantPeriod,
  sanitizeGrantPeriod,
} from "../src/lib/entity/category-info/grant-period";

// --- Reject: checklist prose after "신청 기간," ---
assert.equal(
  extractGrantPeriod(
    "필수 체크 요소는 신청 기간, 접수 마감 시점, 협약 은행별 신청처, 소득금액증명원 등 필수 준비물 구비 여부입니다.",
  ),
  undefined,
  "reject comma checklist after 신청 기간",
);

// --- Reject: table label followed by news headline ---
const newsBleed = extractGrantPeriod(
  "신청 기간\n청년도약계좌 갈아타기 가능할까? 2026 청년미래적금 조건, 신청 기간 | 청년도약계좌 갈아타기 가능할까? KB Think",
);
assert.equal(newsBleed, undefined, "reject news title after 신청 기간 label");

assert.equal(
  sanitizeGrantPeriod(
    "| 청년도약계좌 갈아타기 가능할까? 2026 청년미래적금 조건, 신청 기간 | KB Think",
  ),
  undefined,
);

assert.equal(isPlausibleGrantPeriod(", 접수 마감 시점, 신청처"), false);

// --- Accept: real period strings ---
assert.equal(
  extractGrantPeriod("신청 기간: 2025.1.1 ~ 2025.12.31"),
  "2025.1.1 ~ 2025.12.31",
);
assert.equal(extractGrantPeriod("신청기간 : 연중 상시 (은행 영업일)"), "연중 상시 (은행 영업일)");
assert.equal(
  sanitizeGrantPeriod("2026. 6. 15.(월) ~ 2026. 12. 31.(목)"),
  "2026. 6. 15.(월) ~ 2026. 12. 31.(목)",
);
assert.equal(isPlausibleGrantPeriod("상시신청"), true);
assert.equal(isPlausibleGrantPeriod("접수기관 별 상이"), true);
assert.equal(
  isPlausibleGrantPeriod("만 65세 생일이 속하는 달의 1개월 전부터 신청 가능"),
  true,
);
assert.equal(
  isPlausibleGrantPeriod("매년 사업개시 공고일~12월 15일(예산 소진시 조기 종료)"),
  true,
);

console.log("OK grant period guards");
