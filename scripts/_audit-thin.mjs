const base = process.argv[2] || "https://www.kindexlab.com";
const sample = Number(process.argv[3] ?? 14);

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const ranking = locs.filter((u) => u.includes("/ranking/"));
const channelPosts = locs.filter((u) => /\/(entertainment|politics|economy|culture)\/\d{4}-/.test(u));

console.log(`sitemap: ${locs.length} URLs  ·  /ranking/ ${ranking.length}  ·  칼럼 ${channelPosts.length}`);

/** Strips tags/scripts and returns visible character count, spaces removed. */
function visibleChars(html) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");
  return body.replace(/&[a-z#0-9]+;/gi, "").replace(/\s/g, "").length;
}

function pick(arr, n) {
  const step = Math.max(1, Math.floor(arr.length / n));
  return arr.filter((_, i) => i % step === 0).slice(0, n);
}

async function audit(label, urls) {
  console.log(`\n=== ${label} (${urls.length} sampled) ===`);
  const rows = [];
  for (const u of urls) {
    try {
      const res = await fetch(u);
      const html = await res.text();
      const chars = visibleChars(html);
      const hasAnalysis = html.includes('id="today-analysis"');
      const hasArticleBody = /<h2[^>]*>/.test(html);
      rows.push({ u, status: res.status, chars, hasAnalysis, hasArticleBody });
    } catch (e) {
      rows.push({ u, status: "ERR", chars: 0, hasAnalysis: false, hasArticleBody: false });
    }
  }
  rows.sort((a, b) => a.chars - b.chars);
  for (const r of rows) {
    const path = decodeURIComponent(r.u.replace(base, ""));
    console.log(
      `${String(r.chars).padStart(6)}자  ${String(r.status).padStart(3)}  ` +
        `분석=${r.hasAnalysis ? "Y" : "N"} h2=${r.hasArticleBody ? "Y" : "N"}  ${path.slice(0, 78)}`,
    );
  }
  const c = rows.map((r) => r.chars).sort((a, b) => a - b);
  console.log(`  중앙값 ${c[Math.floor(c.length / 2)]}자 · 1000자 미만 ${c.filter((n) => n < 1000).length}/${c.length}건`);
}

await audit("/ranking/ 상세", pick(ranking, sample));
await audit("칼럼 페이지", pick(channelPosts, 6));
