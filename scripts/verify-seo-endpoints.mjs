// Read-only check of sitemap.xml / feed.xml / robots.txt against live data.
const base = process.env.BASE_URL ?? "http://localhost:3000";

async function get(path) {
  const started = Date.now();
  const res = await fetch(`${base}${path}`);
  const body = await res.text();
  return { status: res.status, body, ms: Date.now() - started, type: res.headers.get("content-type") };
}

const sitemap = await get("/sitemap.xml");
const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const lastmods = [...sitemap.body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
const ranking = urls.filter((u) => u.includes("/ranking/"));
const boardRows = ranking.filter((u) => u.includes("--"));
const distinctDays = new Set(lastmods.map((d) => d.slice(0, 10)));

console.log(`sitemap.xml · HTTP ${sitemap.status} · ${sitemap.ms}ms · ${sitemap.type}`);
console.log(`  총 URL ${urls.length}개 (상세 ${ranking.length} · 보드행 슬러그 ${boardRows.length})`);
console.log(`  lastmod ${lastmods.length}개 · 서로 다른 날짜 ${distinctDays.size}종`);
console.log(`  중복 URL ${urls.length - new Set(urls).size}개`);

const feed = await get("/feed.xml");
const items = [...feed.body.matchAll(/<item>/g)].length;
const guids = [...feed.body.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g)].map((m) => m[1]);
console.log(`\nfeed.xml · HTTP ${feed.status} · ${feed.ms}ms · ${feed.type}`);
console.log(`  item ${items}개 · 고유 guid ${new Set(guids).size}개`);
console.log(`  sitemap에 포함된 guid ${guids.filter((g) => urls.includes(g)).length}/${guids.length}개`);

const robots = await get("/robots.txt");
console.log(`\nrobots.txt · HTTP ${robots.status}`);
console.log(robots.body.trim().split("\n").map((line) => `  ${line}`).join("\n"));

console.log("\n상세 URL 샘플:");
for (const url of ranking.slice(0, 5)) console.log(`  ${decodeURIComponent(url)}`);
