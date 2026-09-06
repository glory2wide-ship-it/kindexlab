/**
 * Read-only inspection of the premium rebuild pipeline.
 *
 * Exercises keyword collection, news retrieval and monetization placement
 * without calling the LLM or writing to any store, so the wiring can be
 * verified before a rebuild is authorised.
 *
 *   npm run premium:check -- "원달러 환율"
 */
import { isGoogleNewsUrl } from "../src/lib/news/unwrap";
import { collectPremiumContext, MIN_PREMIUM_SOURCES } from "../src/lib/premium/context";
import { collectPremiumTargets } from "../src/lib/premium/keywords";
import {
  PREMIUM_BANNED_PHRASES,
  PREMIUM_MIN_CHARS,
  STATIC_SYSTEM_PROMPT,
  buildSinglePassUserPrompt,
  findBannedPhrases,
  premiumCharCount,
} from "../src/lib/premium/prompt";
import { describePlacements, injectMonetization } from "../src/lib/premium/widgets";

const SAMPLE = [
  "# 표본 제목",
  "",
  "리드 문단입니다.",
  "",
  "## 배경",
  "",
  "본문 문단.",
  "",
  "### 세부 논점",
  "",
  "본문 문단.",
  "",
  "## 자주 묻는 질문",
  "",
  "**Q. 질문**",
  "",
  "A. 답변",
  "",
  '<script type="application/ld+json">{}</script>',
].join("\n");

async function main() {
  const keyword = process.argv[2];

  console.log("── 프롬프트 (single-pass) ────────────────");
  console.log(`STATIC_SYSTEM_PROMPT: ${STATIC_SYSTEM_PROMPT.length}자`);
  console.log(`금지어 ${PREMIUM_BANNED_PHRASES.length}개 · 최소 분량 ${PREMIUM_MIN_CHARS}자`);
  console.log(
    `금지어 감지 테스트: ${findBannedPhrases("결론적으로 귀추가 주목된다").join(", ") || "(없음)"}`,
  );
  console.log(`자수 계산 테스트("가 나 다") = ${premiumCharCount("가 나 다")}`);
  const sampleUser = buildSinglePassUserPrompt({
    briefing: true,
    mode: "full",
    channel: "travel",
    categoryHint: "여행 정부지원금",
    focusKeyword: "근로자 휴가지원사업",
    relatedKeywords: ["관광두레"],
    newsContext: "[샘플] 뉴스 컨텍스트",
    editionDate: "2026-09-04",
  });
  console.log(`user prompt sample: ${sampleUser.length}자 (변수만)`);

  console.log("\n── 위젯 배치 ────────────────────────────");
  const injected = injectMonetization(SAMPLE, "테스트키워드", {
    faqAnchor: '<script type="application/ld+json">{}</script>',
  });
  for (const placement of describePlacements(injected)) {
    console.log(`· ${placement.kind} @ ${placement.placement}`);
  }
  console.log(`AffiliateWidget 태그: ${injected.match(/<AffiliateWidget[^>]*>/)?.[0] ?? "없음"}`);

  console.log("\n── 키워드 수집 ──────────────────────────");
  const targets = await collectPremiumTargets();
  console.log(`총 ${targets.length}개 키워드`);
  const byChannel = new Map<string, number>();
  for (const target of targets) {
    byChannel.set(target.channel, (byChannel.get(target.channel) ?? 0) + 1);
  }
  for (const [channel, count] of byChannel) console.log(`· ${channel}: ${count}개`);
  console.log(
    `샘플: ${targets
      .slice(0, 5)
      .map((target) => `${target.keyword}(${target.channel})`)
      .join(", ")}`,
  );

  const probe = keyword ?? targets[0]?.keyword;
  if (!probe) return;

  console.log(`\n── RAG 컨텍스트: ${probe} ───────────────`);
  const startedAt = Date.now();
  const context = await collectPremiumContext(probe);
  console.log(`providers=${context.providers.join(",") || "(없음)"} · ${Date.now() - startedAt}ms`);
  console.log(
    `원문 URL 복원 ${context.unwrapped.resolved}건 · 해석 불가 제외 ${context.unwrapped.failed}건`,
  );
  console.log(`실 URL 확보 ${context.sources.length}건 (최소 ${MIN_PREMIUM_SOURCES}건 필요)`);
  const wrapped = context.sources.filter((source) => isGoogleNewsUrl(source.url)).length;
  console.log(`잔존 리디렉션 URL: ${wrapped}건 ${wrapped === 0 ? "(정상)" : "(비정상)"}`);
  for (const source of context.sources) {
    console.log(`· [${source.publisher}] ${source.title}`);
    console.log(`  ${source.url}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
