import assert from "node:assert/strict";
import {
  analysisEntryMatchesEntity,
  normalizeAnalysisMatchKey,
  remountAnalysisForEntity,
  strongAnalysisKeywordIdentity,
  type CachedAnalysis,
} from "../src/lib/analysis/store";

function stub(partial: Partial<CachedAnalysis> & Pick<CachedAnalysis, "slug" | "keyword">): CachedAnalysis {
  return {
    editionDate: "2026-09-17",
    generatedAt: "2026-09-16T20:00:00.000Z",
    expiresAt: "2026-09-19T20:00:00.000Z",
    provenance: { kind: "chain", newsDocs: 1, publishers: [], facts: [], model: "gemini-3.6-flash", buildMs: 1 },
    article: {
      id: "x",
      slug: "x",
      title: "t",
      excerpt: "e",
      focusKeyword: partial.keyword,
      supportKeyword: "",
      entitySlug: partial.slug,
      editionDate: "2026-09-17",
      publishedAt: "2026-09-16T20:00:00.000Z",
      readingMinutes: 3,
      characterCount: 1000,
      reviewed: true,
      sections: [
        {
          heading: "❶ 오늘의 결론",
          headingLevel: 2,
          paragraphs: [
            "테스트 본문입니다. 과거 생성된 오늘의 분석이 상세 페이지 슬롯을 채워야 합니다. ".repeat(3),
          ],
        },
      ],
      faq: [],
      table: { headers: [], rows: [] },
      internalLink: { href: "/", label: "홈" },
      externalLink: { href: "https://example.com", label: "원문" },
    },
    ...partial,
  };
}

assert.equal(normalizeAnalysisMatchKey("[보건복지부] 기초연금"), "기초연금");
assert.equal(strongAnalysisKeywordIdentity("근로장려금", "근로장려금"), true);
assert.equal(strongAnalysisKeywordIdentity("청년", "청년내일저축계좌"), false);

assert.equal(
  analysisEntryMatchesEntity(
    stub({ slug: "government-subsidy-search--보건복지부-기초연금", keyword: "[보건복지부] 기초연금" }),
    "government-subsidy-search--기초연금",
    "[보건복지부] 기초연금",
  ),
  true,
);

assert.equal(
  analysisEntryMatchesEntity(
    stub({ slug: "government-support-fund--보건복지부-청년내일저축계좌", keyword: "[보건복지부] 청년내일저축계좌" }),
    "government-support-fund--자산형성지원사업",
    "자산형성지원사업(청년내일저축계좌)",
  ),
  true,
);

// Cross-board / legacy politics slug must still find the prior Gemini column.
assert.equal(
  analysisEntryMatchesEntity(
    stub({
      slug: "government-support-fund--국세청-근로장려금",
      keyword: "[국세청] 근로장려금",
    }),
    "pol-subsidy-근로장려금",
    "[국세청] 근로장려금",
  ),
  true,
);

// Must not cross-wire unrelated musicals that only share "뮤지컬".
assert.equal(
  analysisEntryMatchesEntity(
    stub({
      slug: "performance-ticket-ranking--서울-뮤지컬-사의찬미-2026-2nd-stage",
      keyword: "[서울] 뮤지컬 [사의찬미 2026 2ND STAGE]",
    }),
    "performance-ticket-ranking--뮤지컬데스노트",
    "[서울] 뮤지컬 데스노트",
  ),
  false,
);

const remounted = remountAnalysisForEntity(
  stub({ slug: "government-subsidy-search--교육부-국가장학금", keyword: "[교육부] 국가장학금" }),
  "government-subsidy-search--국가장학금",
  "[교육부] 국가장학금",
);
assert.equal(remounted.slug, "government-subsidy-search--국가장학금");
assert.equal(remounted.article.entitySlug, "government-subsidy-search--국가장학금");

console.log("analysis alias remount checks ok");
