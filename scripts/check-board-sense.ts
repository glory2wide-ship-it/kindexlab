/**
 * Board-sense unit checks across categories.
 * Run: npx tsx scripts/check-board-sense.ts
 */
import assert from "node:assert/strict";
import {
  boardSenseQueries,
  detectBoardSenseMismatch,
  mergeSenseQueries,
  resolveBoardSense,
} from "../src/lib/boards/sense";

const book = resolveBoardSense({
  boardSlug: "bestseller-surge-index",
  keyword: "코스모스",
});
assert.ok(book);
assert.match(book!.senseLabel, /도서|세이건/);
assert.equal(book!.domain, "book");

const queries = boardSenseQueries("코스모스", book);
assert.ok(queries[0]?.includes("책") || queries[0]?.includes("세이건"), queries.join(" | "));

const merged = mergeSenseQueries("코스모스", ["코스모스 유튜브"], book);
assert.ok(merged[0]?.includes("책") || merged[0]?.includes("세이건"));

const flowerCopy =
  "백로를 앞두고 코스모스가 개화하며 가을 꽃길이 이어졌습니다. 가로수와 야생화가 만개했습니다.";
assert.equal(
  detectBoardSenseMismatch({
    plainText: flowerCopy,
    boardSlug: "bestseller-surge-index",
    keyword: "코스모스",
  }),
  "book-vs-flower",
);

const bookCopy =
  "칼 세이건의 과학 교양서 코스모스가 서점 베스트셀러에서 다시 주목받고 있습니다. 독자와 출판사 반응을 정리합니다.";
assert.equal(
  detectBoardSenseMismatch({
    plainText: bookCopy,
    boardSlug: "bestseller-surge-index",
    keyword: "코스모스",
  }),
  null,
);

const mixedBad =
  "절기상 백로를 앞두고 가을 꽃이 만개한 가운데, 도서 및 공연 현장까지 연결되는 코스모스 검색 흐름이 나타났습니다. 개화와 산책로, 야생화 소식입니다.";
assert.equal(
  detectBoardSenseMismatch({
    plainText: mixedBad,
    boardSlug: "bestseller-surge-index",
    keyword: "코스모스",
  }),
  "book-vs-flower",
);

// Board-scoped: 코스모스 override must not apply to unrelated boards.
const stockApple = resolveBoardSense({
  boardSlug: "overseas-stock-index",
  keyword: "애플",
});
assert.ok(stockApple);
assert.match(stockApple!.senseLabel, /주식/);
assert.equal(
  detectBoardSenseMismatch({
    plainText: "청송 사과 농가와 과일 사과 가격, 애플파이 축제가 이어졌습니다. 사과 가격이 올랐습니다.",
    boardSlug: "overseas-stock-index",
    keyword: "애플",
  }),
  "apple-vs-fruit",
);
assert.equal(
  detectBoardSenseMismatch({
    plainText: "애플 주가와 시총, 아이폰 실적 발표가 나스닥 투심을 흔들었습니다. AAPL 시세를 점검합니다.",
    boardSlug: "overseas-stock-index",
    keyword: "애플",
  }),
  null,
);

// Nature leak on movie board
assert.ok(
  detectBoardSenseMismatch({
    plainText: "백로를 앞두고 개화한 야생화 꽃길이 이어졌습니다. 산책로 전령사 소식입니다.",
    boardSlug: "boxoffice-expectation",
    keyword: "파묘",
  }),
);

// Unit coverage: every common unit resolves
for (const [slug, keyword] of [
  ["kospi-fomo-index", "삼성전자"],
  ["performance-ticket-ranking", "위키드"],
  ["game-esports-ranking", "리그오브레전드"],
  ["government-subsidy-search", "청년도약계좌"],
  ["boxoffice-expectation", "파묘"],
] as const) {
  const sense = resolveBoardSense({ boardSlug: slug, keyword });
  assert.ok(sense, slug);
  assert.ok(sense!.searchQualifiers.length > 0, slug);
  assert.ok(sense!.promptRules.length > 0, slug);
}

console.log("board-sense checks ok");
