import { readFileSync } from "node:fs";

const edition = process.argv[2] ?? "2026-09-01";
const all = JSON.parse(readFileSync("src/data/posts/generated.json", "utf8")).articles ?? [];
const fresh = all.filter((p) => p.editionDate === edition);
const old = all.filter((p) => p.editionDate !== edition);

const body = (p) => (p.sections ?? []).flatMap((s) => s.paragraphs ?? []).join("\n");
const chars = (t) => t.replace(/\s/g, "").length;

const GENERIC_ANAPHOR = /(이 제도|해당 사안|본 사안)/g;
const GENERIC_HEADING =
  /(향후 전망과 실행|전문가 시각|이해관계와 사회적 파급|이해관계와 파급|사회적 파급 효과)/;
const PLACEHOLDER = /(미공개|미정|미상|추정치|예상치|TBD|TBA|N\/A|확인\s*불가)/;

function report(label, posts) {
  if (!posts.length) {
    console.log(`\n=== ${label}: 0건 ===`);
    return;
  }
  const anaphor = posts.filter((p) => GENERIC_ANAPHOR.test(body(p)));
  const headings = posts.filter((p) =>
    (p.sections ?? []).some((s) => s.heading && GENERIC_HEADING.test(s.heading)),
  );
  const placeholders = posts.filter((p) =>
    (p.table?.rows ?? []).some((row) => row.some((cell) => PLACEHOLDER.test(cell))),
  );
  const withUrls = posts.filter((p) => (p.sources ?? []).some((s) => s.url));
  const lens = posts.map((p) => chars(body(p))).sort((a, b) => a - b);
  const pct = (n) => `${((n / posts.length) * 100).toFixed(0)}%`;

  console.log(`\n=== ${label}: ${posts.length}건 ===`);
  console.log(`  치환어 오염('이 제도'/'해당 사안')  ${String(anaphor.length).padStart(3)}건  ${pct(anaphor.length)}`);
  console.log(`  템플릿 소제목                      ${String(headings.length).padStart(3)}건  ${pct(headings.length)}`);
  console.log(`  표에 자리채움 값                    ${String(placeholders.length).padStart(3)}건  ${pct(placeholders.length)}`);
  console.log(`  출처 URL 보유                      ${String(withUrls.length).padStart(3)}건  ${pct(withUrls.length)}`);
  console.log(`  글자수 중앙값 ${lens[Math.floor(lens.length / 2)]}자 · 1800자 미만 ${lens.filter((n) => n < 1800).length}건`);
}

report(`이전 글 (edition≠${edition})`, old);
report(`신규 글 (edition=${edition})`, fresh);

if (fresh.length) {
  console.log(`\n--- 신규 글 소제목 목록 ---`);
  for (const p of fresh) {
    console.log(`\n[${p.focusKeyword}] ${p.title}`);
    for (const s of p.sections ?? []) console.log(`   · ${s.heading}`);
    const rows = p.table?.rows ?? [];
    console.log(`   표: ${p.table?.caption ?? "(없음)"} — ${rows.length}행`);
    for (const row of rows) console.log(`      | ${row.join(" | ")}`);
    console.log(`   출처: ${(p.sources ?? []).map((s) => `${s.label}${s.url ? "(링크O)" : "(링크X)"}`).join(", ")}`);
  }
}
