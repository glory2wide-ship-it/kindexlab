// Read-only audit of stored premium columns against the rebuild checklist.
import { readFile } from "node:fs/promises";

const raw = JSON.parse(await readFile("src/data/analysis/cache.json", "utf8"));
const list = Array.isArray(raw) ? raw : (raw.entries ?? Object.values(raw));
const stored = list.filter((entry) => entry?.article?.bodyMarkdown);

console.log(`저장된 프리미엄 글: ${stored.length}건\n`);

for (const entry of stored) {
  const article = entry.article;
  const md = article.bodyMarkdown;
  const h2 = (md.match(/^## /gm) ?? []).length;
  const adsMid = (md.match(/data-content-slot="mid"/g) ?? []).length;
  const adsFooter = (md.match(/data-content-slot="footer"/g) ?? []).length;
  const affiliate = (md.match(/<AffiliateWidget/g) ?? []).length;
  const faqAt = md.indexOf("자주 묻는 질문");
  const affiliateAt = md.indexOf("<AffiliateWidget");
  const sources = article.sources ?? [];
  const stillWrapped = sources.filter((source) => source.url.includes("news.google.com")).length;

  console.log(`── ${article.focusKeyword} · ${article.characterCount}자`);
  console.log(`   H2 ${h2}개 / 본문 중간 광고 ${adsMid}개 / 하단 광고 ${adsFooter}개`);
  console.log(`   제휴 위젯 ${affiliate}개 · FAQ 뒤 배치 ${affiliateAt > faqAt ? "예" : "아니오"}`);
  console.log(
    `   JSON-LD Article ${/"Article"/.test(article.jsonLd ?? "")} · FAQPage ${/"FAQPage"/.test(article.jsonLd ?? "")}`,
  );
  console.log(`   출처 ${sources.length}건 · 구글 리디렉션 잔존 ${stillWrapped}건`);
  for (const source of sources) console.log(`     · ${source.publisher} ${source.url}`);
  console.log();
}
