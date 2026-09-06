/**
 * Samples the landing page twice and reports which sections actually moved.
 *
 * Usage: node scripts/_check-live-refresh.mjs [origin] [waitSeconds]
 */
import crypto from "node:crypto";

const origin = process.argv[2] || "https://www.kindexlab.com";
const waitSec = Number(process.argv[3] ?? 0);

const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 10);

function sections(html) {
  // Heatmap tile labels live in the svg text nodes; desk cards and the column
  // rail are plain anchors, so each section is identified by its own link shape.
  const tiles = [...html.matchAll(/<text[^>]*>([^<]{2,40})<\/text>/g)].map((m) => m[1].trim());
  const desk = [...html.matchAll(/href="\/ranking\/([^"]+)"/g)].map((m) => m[1]);
  const columns = [...html.matchAll(/href="\/posts\/([^"]+)"/g)].map((m) => m[1]);
  return {
    "히트맵 타일": tiles.slice(0, 25),
    "데스크 카드 링크": [...new Set(desk)].slice(0, 12),
    "브리핑 칼럼 링크": [...new Set(columns)].slice(0, 7),
  };
}

async function sample() {
  const res = await fetch(`${origin}/?cb=${Date.now()}`, { cache: "no-store" });
  const html = await res.text();
  return { status: res.status, age: res.headers.get("age"), sections: sections(html) };
}

const first = await sample();
console.log(`1차 수집  status ${first.status}  age ${first.age ?? "-"}`);
for (const [name, list] of Object.entries(first.sections)) {
  console.log(`  ${name}: ${list.length}개  ${hash(list.join("|"))}`);
}

if (waitSec > 0) {
  console.log(`\n${waitSec}초 대기...`);
  await new Promise((r) => setTimeout(r, waitSec * 1000));
  const second = await sample();
  console.log(`\n2차 수집  status ${second.status}  age ${second.age ?? "-"}`);
  let anyChange = false;
  for (const [name, list] of Object.entries(second.sections)) {
    const before = first.sections[name];
    const changed = before.join("|") !== list.join("|");
    if (changed) anyChange = true;
    console.log(`  ${name}: ${hash(list.join("|"))}  ${changed ? "변경됨" : "동일 (변화 없음)"}`);
  }
  console.log(`\n결론: ${anyChange ? "일부 섹션이 갱신됨" : "세 섹션 모두 전혀 변하지 않음"}`);
}
