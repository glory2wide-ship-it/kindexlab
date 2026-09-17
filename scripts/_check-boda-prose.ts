/**
 * Guard: 보다 / 무엇봅니다 corruption must not survive punctuation + honorific.
 *   npx tsx scripts/_check-boda-prose.ts
 */
import assert from "node:assert/strict";
import {
  insertMissingKoreanPeriods,
  ensureSentencePunctuation,
} from "../src/lib/premium/seo-format";
import {
  repairComparativeBodaCorruption,
  toHonorificProse,
} from "../src/lib/editorial/honorific";

const comparative = "전략이 무엇보다 중요해졌습니다.";
assert.equal(insertMissingKoreanPeriods(comparative), comparative);
assert.equal(toHonorificProse(comparative), comparative);
assert.equal(ensureSentencePunctuation(comparative), comparative);

const corrupted = "전략이 무엇봅니다. 중요해졌습니다.";
assert.equal(
  repairComparativeBodaCorruption(corrupted),
  "전략이 무엇보다 중요해졌습니다.",
);
assert.equal(ensureSentencePunctuation(corrupted), "전략이 무엇보다 중요해졌습니다.");

const legit = "상황을 살펴봅니다. 다음 일정은 공개됩니다.";
assert.equal(repairComparativeBodaCorruption(legit), legit);

console.log("OK boda prose guards");
