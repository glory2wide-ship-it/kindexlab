const base = process.argv[2] || "http://localhost:3000";
const path = process.argv[3] || "/";

const res = await fetch(base + path);
const html = await res.text();

// Each tile paints more than one rect (fill plus overlay), so dedupe on exact
// geometry before measuring; otherwise every share is counted twice.
const seen = new Set();
const rects = [];
for (const m of html.matchAll(
  /<rect[^>]*?x="([\d.-]+)"[^>]*?y="([\d.-]+)"[^>]*?width="([\d.]+)"[^>]*?height="([\d.]+)"/g,
)) {
  const key = m.slice(1, 5).join(":");
  if (seen.has(key)) continue;
  seen.add(key);
  const w = Number(m[3]);
  const h = Number(m[4]);
  if (w > 8 && h > 8) rects.push({ w, h, area: w * h });
}

rects.sort((a, b) => b.area - a.area);
// Tiles tile the canvas, so their sum is the canvas area net of gutters.
const canvas = rects.reduce((sum, r) => sum + r.area, 0);
const share = (r) => ((r.area / canvas) * 100).toFixed(2);

console.log(`${path}  status ${res.status}`);
console.log(`  타일 수        ${rects.length}`);
console.log(`  1위 면적 비중  ${share(rects[0])}%   크기 ${rects[0].w}x${rects[0].h} (가로세로비 ${(rects[0].w / rects[0].h).toFixed(2)})`);
console.log(`  2위 면적 비중  ${share(rects[1])}%`);
console.log(`  3위 면적 비중  ${share(rects[2])}%`);
console.log(`  최하위 비중    ${share(rects[rects.length - 1])}%`);
