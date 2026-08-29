/**
 * Generates one premium column and prints the audit result without persisting
 * anything. Use this to check prompt or length changes before committing a
 * rebuild to a batch run.
 *
 *   npm run premium:try -- "원달러 환율"
 */
import { analysisLogger } from "../src/lib/analysis/log";
import { slugify } from "../src/lib/ingestion/names";
import { isGoogleNewsUrl } from "../src/lib/news/unwrap";
import { generatePremiumArticle } from "../src/lib/premium/generate";
import { PREMIUM_MAX_CHARS, PREMIUM_MIN_CHARS } from "../src/lib/premium/prompt";

async function main() {
  const keyword = process.argv[2];
  if (!keyword) {
    console.error('키워드를 지정하세요: npm run premium:try -- "원달러 환율"');
    process.exitCode = 1;
    return;
  }

  const startedAt = Date.now();
  const result = await generatePremiumArticle({
    keyword,
    slug: slugify(keyword),
    category: process.argv[3],
    logger: analysisLogger(`try:${keyword}`),
  });

  console.log(`\n총 소요 ${Math.round((Date.now() - startedAt) / 1000)}초`);

  if (!result.ok) {
    console.log(`실패: ${result.reason}${result.detail ? ` (${result.detail})` : ""}`);
    // Set the code rather than exiting: sockets from retrieval may still be
    // closing, and tearing the loop down under them aborts the process.
    process.exitCode = 1;
    return;
  }

  const article = result.article;
  const inRange = article.characterCount >= PREMIUM_MIN_CHARS && article.characterCount <= PREMIUM_MAX_CHARS;

  console.log("\n── 감사 결과 ────────────────────────────");
  console.log(`제목: ${article.title}`);
  console.log(
    `분량: ${article.characterCount}자 ${inRange ? "(정상)" : `(기준 ${PREMIUM_MIN_CHARS}~${PREMIUM_MAX_CHARS}자 이탈)`}`,
  );
  console.log(`본문 키워드 배치: ${article.keywordCount}회 (기준 5~7회)`);
  console.log(`섹션: ${article.sections.length}개 · FAQ: ${article.faq.length}개 · 표 ${article.table.rows.length}행`);
  console.log(`실행 팁: ${article.takeaways.length}개`);

  console.log("\n── 수익화 배치 ──────────────────────────");
  for (const placement of article.placements) console.log(`· ${placement.kind} @ ${placement.placement}`);

  console.log("\n── 출처 (E-E-A-T) ───────────────────────");
  const wrapped = article.sources.filter((source) => isGoogleNewsUrl(source.url)).length;
  console.log(`잔존 리디렉션 URL: ${wrapped}건 ${wrapped === 0 ? "(정상)" : "(비정상)"}`);
  for (const source of article.sources) console.log(`· [${source.publisher}] ${source.url}`);
  console.log(`\n본문 인용 링크: ${article.externalLink.href}`);
  console.log(`내부 링크: ${article.internalLink.href}`);

  console.log("\n── JSON-LD ──────────────────────────────");
  console.log(`Article: ${article.jsonLd.includes('"Article"')} · FAQPage: ${article.jsonLd.includes('"FAQPage"')}`);

  console.log("\n── 본문 미리보기 ────────────────────────");
  console.log(article.bodyMarkdown.slice(0, 900));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
