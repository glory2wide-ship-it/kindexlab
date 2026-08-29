// Read-only check that a rendered detail page carries the monetization and SEO
// markup the rebuild is supposed to place.
//
//   node scripts/verify-premium-render.mjs "board-slug--키워드"
const slug = process.argv[2];
if (!slug) {
  console.error('슬러그를 지정하세요: node scripts/verify-premium-render.mjs "board--키워드"');
  process.exit(1);
}

const url = `http://localhost:3000/ranking/${encodeURIComponent(slug)}`;
const response = await fetch(url);
const html = await response.text();

console.log(`${url}`);
console.log(`HTTP ${response.status} · ${html.length} bytes\n`);

const slots = (html.match(/data-content-slot=/g) ?? []).length;
const adUnits = (html.match(/adsbygoogle/g) ?? []).length;
console.log(`광고 컨테이너: ${slots}개 (실제 <ins> 유닛 ${adUnits}개)`);
if (slots > 0 && adUnits === 0) {
  console.log("  → NEXT_PUBLIC_ADSENSE_CLIENT 미설정. 자리는 잡혀 있고 게시자 ID 입력 시 노출됩니다.");
}

const coupang = [...html.matchAll(/coupang\.com\/np\/search\?q=([^&"]+)/g)].map((match) =>
  decodeURIComponent(match[1]),
);
console.log(`제휴 위젯 링크: ${coupang.length}개`);
for (const query of coupang.slice(0, 4)) console.log(`  · 검색어 "${query}"`);

const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
const types = new Set();
for (const block of blocks) {
  for (const match of block[1].matchAll(/"@type"\s*:\s*"([^"]+)"/g)) types.add(match[1]);
}
console.log(`\nJSON-LD ${blocks.length}블록 · 타입: ${[...types].join(", ")}`);
console.log(`  Article ${types.has("Article")} · FAQPage ${types.has("FAQPage")}`);

const external = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)]
  .map((match) => match[1])
  .filter((link) => !/coupang|jsdelivr|fonts\.googleapis|schema\.org/.test(link));
const wrapped = external.filter((link) => link.includes("news.google.com"));
console.log(`\n본문 출처 링크 ${external.length}개 · 구글 리디렉션 잔존 ${wrapped.length}개`);
for (const link of external) console.log(`  · ${link}`);
