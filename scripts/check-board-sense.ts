/**
 * Quick unit checks for board-sense disambiguation (코스모스 = book, not flower).
 * Run: npx tsx scripts/check-board-sense.ts
 */
import assert from "node:assert/strict";
import {
  boardSenseQueries,
  detectBoardSenseMismatch,
  resolveBoardSense,
} from "../src/lib/boards/sense";

const sense = resolveBoardSense({
  boardSlug: "bestseller-surge-index",
  keyword: "코스모스",
});
assert.ok(sense, "sense for bestseller 코스모스");
assert.match(sense!.senseLabel, /도서|세이건/);
assert.ok(sense!.searchQualifiers.some((q) => q.includes("책") || q.includes("세이건")));

const queries = boardSenseQueries("코스모스", sense);
assert.ok(queries[0]?.includes("책") || queries[0]?.includes("세이건"), queries.join(" | "));

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

// Real bad cache sample: flower-heavy with a few weak "도서" mentions.
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

console.log("board-sense checks ok");
