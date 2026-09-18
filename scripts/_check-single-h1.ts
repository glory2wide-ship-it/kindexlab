/**
 * Guard: key hub pages must expose exactly one <h1> (Naver Search Advisor).
 *   SEO_BASE_URL=http://127.0.0.1:43123 npx tsx scripts/_check-single-h1.ts
 */
import assert from "node:assert/strict";

const base = (process.env.SEO_BASE_URL || "http://127.0.0.1:43123").replace(/\/+$/, "");

const PATHS = [
  "/",
  "/entertainment",
  "/entertainment/briefing",
  "/entertainment/archive",
  "/politics",
  "/politics/briefing",
  "/politics/archive",
  "/economy/briefing",
  "/culture/briefing",
  "/travel/archive",
  "/briefing",
];

async function countH1(path: string): Promise<{ count: number; texts: string[] }> {
  const res = await fetch(`${base}${path}`, { redirect: "follow" });
  assert.equal(res.ok, true, `${path} status ${res.status}`);
  const html = await res.text();
  const texts: string[] = [];
  for (const match of html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)) {
    const text = match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    texts.push(text.slice(0, 80));
  }
  return { count: texts.length, texts };
}

for (const path of PATHS) {
  const { count, texts } = await countH1(path);
  assert.equal(
    count,
    1,
    `${path} expected 1 h1, got ${count}: ${JSON.stringify(texts)}`,
  );
}

console.log(`OK single H1 on ${PATHS.length} hub pages (${base})`);
