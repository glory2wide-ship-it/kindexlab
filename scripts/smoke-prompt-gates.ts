/**
 * Smoke-check today's article-generation prompt/gate fixes.
 *   npx tsx --env-file=.env.local scripts/smoke-prompt-gates.ts
 */
import { readAnalysis } from "../src/lib/analysis/store";
import {
  editorialGroundingRules,
  isKindexFeatureRankTemplate,
  isKindexFeatureSectionHeading,
  isUnusableKindexFeatureBody,
  kindexDataTrendInterpretationRules,
  stripNumberedHeadingPrefix,
} from "../src/lib/editorial/tense-rules";
import {
  applyHybridAnalysisHeadings,
  buildDataJournalistUserPrompt,
  buildHybridAnalysisSystemPrompt,
  resolveHybridOutlookHeading,
  resolveHybridReaderHeading,
} from "../src/lib/premium/data-journalist-prompt";
import { buildBriefingSystemPrompt } from "../src/lib/premium/prompt";

const oldGlue =
  "웰니스관광 클러스터는 해당 히트맵에서 3위에 있습니다. 직전 대비 순위 변동은 정체(0%)입니다. 종합하면 웰니스관광 클러스터 관심은 보드 안 상대 순위·움직임으로 읽습니다.";

function assert(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  assert("rank-template detected", isKindexFeatureRankTemplate(oldGlue));
  assert("rank-template unusable", isUnusableKindexFeatureBody(oldGlue));
  assert(
    "heading digits preserved (100만)",
    stripNumberedHeadingPrefix("❶ 100만 인파가 몰린 한강공원") === "100만 인파가 몰린 한강공원",
  );
  assert(
    "heading digits preserved (2026년)",
    stripNumberedHeadingPrefix("❷ 2026년 모집 일정") === "2026년 모집 일정",
  );

  const reader = resolveHybridReaderHeading({
    channel: "travel",
    categoryHint: "government-grant",
    focusKeyword: "[한국관광공사] 관광벤처 공모전",
  });
  const outlook = resolveHybridOutlookHeading({
    channel: "travel",
    categoryHint: "government-grant",
    focusKeyword: "[한국관광공사] 관광벤처 공모전",
  });
  assert("reader heading uses keyword", reader.includes("관광벤처"));
  assert("reader not generic", !reader.includes("지원금을 신청하는 방법"), reader);
  assert("outlook heading uses keyword", outlook.includes("관광벤처"));
  assert("outlook not generic", !outlook.includes("다음 모집·쿠폰 일정을 확인하는 법"), outlook);

  const hybrid = applyHybridAnalysisHeadings(
    [
      {
        heading: "오늘의 결론",
        paragraphs: [
          "관광벤처 공모전은 지역 관광 스타트업 지원이 핵심입니다. 공모 자격과 사업화 일정을 먼저 확인해야 합니다.",
        ],
      },
      {
        heading: "왜 지금 관심이 높아졌나",
        paragraphs: [
          "최근 공모 일정이 공개되며 검색이 늘었습니다. 지자체 연계 프로그램도 함께 주목받고 있습니다.",
        ],
      },
      {
        heading: "지원금을 신청하는 방법",
        paragraphs: ["신청은 관광공사 공고를 기준으로 합니다. 자격·제출 서류를 먼저 점검하세요."],
      },
      {
        heading: "다음 모집·쿠폰 일정을 확인하는 법",
        paragraphs: [
          "다음 모집창은 상반기 공고를 기준으로 봅니다. 일정 변동 여부를 공식 누리집에서 확인하세요.",
        ],
      },
      { heading: "KinDex 데이터가 보여주는 특징", paragraphs: [oldGlue] },
    ],
    {
      channel: "travel",
      categoryHint: "government-grant",
      focusKeyword: "관광벤처 공모전",
      signalFacts: [
        "관광벤처 공모전는 해당 히트맵에서 5위에 있습니다.",
        "직전 대비 순위 변동은 정체(0%)입니다.",
      ],
    },
  );
  const kindex = hybrid.find((section) => section.heading.includes("KinDex"));
  assert("hybrid replaced glue ❺", Boolean(kindex && !isUnusableKindexFeatureBody(kindex.paragraphs[0])));
  assert(
    "hybrid repaired generic ❸/❹",
    !hybrid.some((section) => /지원금을 신청하는 방법|다음 모집·쿠폰 일정을 확인하는 법/.test(section.heading)),
    hybrid.map((section) => section.heading).join(" | "),
  );

  const sysDj = buildHybridAnalysisSystemPrompt("travel");
  const sysLegacy = buildBriefingSystemPrompt("travel");
  const userDj = buildDataJournalistUserPrompt({
    focusKeyword: "관광벤처 공모전",
    editionDate: "2026-09-09",
    newsContext: "테스트 뉴스",
    relatedKeywords: ["관광두레"],
    kindexSignals: "5위",
    channel: "travel",
    categoryHint: "government-grant",
  });
  assert("DJ system has 45~90자", /45~90자/.test(sysDj));
  assert("DJ system bans rank glue", /순위 나열|팩트 문장만|종합하면/.test(sysDj));
  assert("DJ system links ❶~❹", /❶~❹/.test(sysDj));
  assert("DJ user bans rank template", /순위 나열 템플릿|신청·일정·정책/.test(userDj));
  assert("legacy system has 45~90자", /45~90자/.test(sysLegacy));
  assert("grounding bans rank template", /순위 나열 템플릿|종합하면 보드 안/.test(editorialGroundingRules()));
  assert("kindex rules ban rank template", /순위 나열 템플릿/.test(kindexDataTrendInterpretationRules()));

  const entry = await readAnalysis("travel-government-grant-ranking--한국관광공사-관광벤처-공모전");
  assert("smoke article exists", Boolean(entry));
  if (entry) {
    assert("smoke used LLM chain", entry.provenance.kind === "chain", entry.provenance.model);
    const body = (
      entry.article.sections.find((section) => isKindexFeatureSectionHeading(section.heading))
        ?.paragraphs ?? []
    ).join(" ");
    assert("smoke ❺ usable", !isUnusableKindexFeatureBody(body), body.slice(0, 160));
    assert("smoke ❺ not rank template", !isKindexFeatureRankTemplate(body));
    assert(
      "smoke headings not generic",
      !entry.article.sections.some((section) =>
        /지원금을 신청하는 방법|다음 모집·쿠폰 일정을 확인하는 법/.test(section.heading),
      ),
      entry.article.sections.map((section) => section.heading).join(" | "),
    );
    console.log("\n[smoke headings]");
    for (const section of entry.article.sections) {
      console.log("-", section.heading);
    }
    console.log("[smoke ❺]", body);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
