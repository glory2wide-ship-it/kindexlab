// Final tally for the purge-and-rebuild run: article stats + sitemap coverage.
import fs from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const cache = JSON.parse(fs.readFileSync("src/data/analysis/cache.json", "utf8"));
const entries = Object.values(cache.entries ?? cache ?? {}).filter((e) => e && e.article);

const charCount = (text) => (text ?? "").replace(/\s/g, "").length;

function plain(article) {
  const parts = [article.title, article.excerpt];
  for (const s of article.sections ?? []) {
    parts.push(s.heading);
    for (const p of s.paragraphs ?? []) parts.push(p);
  }
  for (const f of article.faq ?? []) parts.push(f.question, f.answer);
  return parts.filter(Boolean).join(" ");
}

let totalChars = 0;
let withSources = 0;
let totalSources = 0;
let googleLeft = 0;
let withJsonLd = 0;
let withAds = 0;
let withAffiliate = 0;
const lengths = [];

for (const entry of entries) {
  const a = entry.article;
  const chars = charCount(plain(a));
  totalChars += chars;
  lengths.push(chars);

  const sources = a.sources ?? entry.provenance?.sources ?? [];
  if (sources.length) withSources += 1;
  totalSources += sources.length;
  googleLeft += sources.filter((s) => (s.url ?? "").includes("news.google.com")).length;

  const body = JSON.stringify(a);
  if (body.includes("FAQPage") || a.jsonLd) withJsonLd += 1;
  if (body.includes("adsense") || body.includes("ad-slot") || body.includes("ContentSlot")) withAds += 1;
  if (body.includes("AffiliateWidget") || body.includes("affiliate")) withAffiliate += 1;
}

const n = entries.length;
lengths.sort((a, b) => a - b);

console.log("=== 생성 결과 ===");
console.log(`총 글 수            ${n}건`);
console.log(`평균 글자 수        ${Math.round(totalChars / n)}자 (공백 제외)`);
console.log(`최소 / 중앙 / 최대  ${lengths[0]} / ${lengths[Math.floor(n / 2)]} / ${lengths[n - 1]}자`);
console.log(`2,000자 이상        ${lengths.filter((l) => l >= 2000).length}건`);

console.log("\n=== 출처(E-E-A-T) ===");
console.log(`출처 보유 글        ${withSources}/${n}건`);
console.log(`총 출처 링크        ${totalSources}개 (글당 평균 ${(totalSources / n).toFixed(1)}개)`);
console.log(`원문 URL 복원율     ${(((totalSources - googleLeft) / totalSources) * 100).toFixed(1)}% (google 잔존 ${googleLeft}개)`);

console.log("\n=== 수익화 / 구조화 ===");
console.log(`JSON-LD 포함        ${withJsonLd}/${n}건`);
console.log(`애드센스 슬롯       ${withAds}/${n}건`);
console.log(`제휴 위젯           ${withAffiliate}/${n}건`);

const res = await fetch(`${base}/sitemap.xml`);
const xml = await res.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const ranking = urls.filter((u) => u.includes("/ranking/"));
const slugs = new Set(entries.map((e) => decodeURIComponent(e.slug)));
const covered = ranking.filter((u) => slugs.has(decodeURIComponent(u.split("/ranking/")[1] ?? "")));
const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);

console.log("\n=== 사이트맵 ===");
console.log(`sitemap.xml         HTTP ${res.status} · 총 ${urls.length}개 URL`);
console.log(`  상세 페이지       ${ranking.length}개`);
console.log(`  생성 글 등록      ${covered.length}/${n}건`);
console.log(`  lastmod 태그      ${lastmods.length}개`);

const feedRes = await fetch(`${base}/feed.xml`);
const feedXml = await feedRes.text();
console.log(`feed.xml            HTTP ${feedRes.status} · item ${[...feedXml.matchAll(/<item>/g)].length}개`);

const missing = entries.filter((e) => !ranking.some((u) => decodeURIComponent(u).endsWith(`/ranking/${decodeURIComponent(e.slug)}`)));
if (missing.length) {
  console.log(`\n사이트맵 누락 ${missing.length}건:`);
  for (const m of missing.slice(0, 10)) console.log(`  ${m.slug}`);
}
