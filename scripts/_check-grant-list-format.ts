/**
 * Guard: grant list formatting must keep eligibility/prep semantics aligned.
 *   npx tsx scripts/_check-grant-list-format.ts
 */
import assert from "node:assert/strict";

// Mirror of formatGrantList rules (keep in sync with enrich.ts).
function isGrantSpamValue(value: string): boolean {
  return /#\w{3,}/.test(value) && value.split("#").length > 3;
}

function formatGrantList(...parts: Array<string | undefined>): string | undefined {
  const chunks = parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  if (!chunks.length) return undefined;
  const items: string[] = [];
  for (const chunk of chunks) {
    const explicitLines = chunk.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
    const looksNumbered =
      explicitLines.length > 1 &&
      explicitLines.filter((line) => /^(?:[0-9]+[.)]|[①-⑮]|[-•·◦○●])\s*/.test(line)).length >=
        Math.ceil(explicitLines.length * 0.6);
    if (looksNumbered) {
      for (const line of explicitLines) {
        const cleaned = line.replace(/^(?:[0-9]+[.)]|[①-⑮]|[-•·◦○●])\s*/, "").replace(/\s+/g, " ").trim();
        if (cleaned.length >= 2 && !isGrantSpamValue(cleaned)) items.push(cleaned);
      }
      continue;
    }
    const pieces = chunk
      .split(
        /(?:\r?\n+|;\s*|·\s*|(?<=[가-힣A-Za-z)）])\s*(?=\d{1,2}[.)]\s)|(?=[①-⑮])|(?=\s*[○●◦]\s*))/,
      )
      .map((piece) =>
        piece
          .replace(/^[\s\-•·\*◦○●①-⑮]+/, "")
          .replace(/^\d{1,2}[.)]\s*/, "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter((piece) => piece.length >= 2 && !isGrantSpamValue(piece));
    if (pieces.length > 1) items.push(...pieces);
    else if (!isGrantSpamValue(chunk)) items.push(chunk);
  }
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const cleaned = item.replace(/\s+/g, " ").trim();
    if (cleaned.length < 2 || isGrantSpamValue(cleaned)) continue;
    if (seen.has(cleaned.toLowerCase())) continue;
    seen.add(cleaned.toLowerCase());
    unique.push(cleaned);
  }
  if (!unique.length) return undefined;
  if (unique.length === 1) return `· ${unique[0]}`;
  return unique.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

// Numbered docs stay as discrete items — never soft-split mid-sentence.
const docs = formatGrantList("1. 신분증\n2. 소득 증명서\n3. 가족관계증명서");
assert.equal(docs, "1. 신분증\n2. 소득 증명서\n3. 가족관계증명서");

// Dates must not become list breaks.
const dated = formatGrantList("차상위계층(2020.12. 이전 출생자) 및 기초생활수급자");
assert.equal(dated, "· 차상위계층(2020.12. 이전 출생자) 및 기초생활수급자");

// Single eligibility clause stays one bullet (no 다-split).
const elig = formatGrantList("기초생활수급자 및 차상위계층에 해당하는 가구입니다");
assert.equal(elig, "· 기초생활수급자 및 차상위계층에 해당하는 가구입니다");

// target + criteria merge without content bleed.
const merged = formatGrantList("만 19세 이상 청년", "가구 소득 중위 120% 이하");
assert.equal(merged, "1. 만 19세 이상 청년\n2. 가구 소득 중위 120% 이하");

console.log("OK grant list format guards");
