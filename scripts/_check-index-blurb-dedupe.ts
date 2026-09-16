/**
 * Guard: entity detail must not show the rank/등락 index blurb twice
 * (profile synopsis + hero line). Seen with 볼빨간사춘기 and many live-tape rows
 * whose `summary` is formatEntityIndexBlurb output.
 *
 *   npm run live:index-blurb
 */
import assert from "node:assert/strict";
import { resolveDetailFacts } from "../src/lib/boards/detail-facts";
import { resolveEntertainmentFacts } from "../src/lib/boards/entertainment-facts";
import { buildTvProgramProfile } from "../src/lib/boards/tv-program-profile";
import {
  entityNarrativeSummary,
  formatEntityIndexBlurb,
  isEntityIndexBlurbText,
} from "../src/lib/entity/index-blurb";
import type { RankingEntity } from "../src/lib/types";

function sample(partial: Partial<RankingEntity> & Pick<RankingEntity, "name" | "slug">): RankingEntity {
  return {
    id: partial.id ?? `live-${partial.slug}`,
    slug: partial.slug,
    name: partial.name,
    nameEn: partial.nameEn ?? partial.name,
    type: partial.type ?? "idol",
    rank: partial.rank ?? 999,
    previousRank: partial.previousRank ?? 900,
    score: partial.score ?? 1000,
    openScore: partial.openScore ?? 1000,
    fluctuationRate: partial.fluctuationRate ?? -2.24,
    volume: partial.volume ?? 1000,
    tags: partial.tags ?? ["live-chart"],
    summary:
      partial.summary ??
      `${partial.name}는 엔터 종합 기준 ${partial.rank ?? 999}위입니다. 등락 ${(partial.fluctuationRate ?? -2.24).toFixed(2)}%.`,
    sourceChannel: partial.sourceChannel ?? "entertainment",
    heatmapGroup: partial.heatmapGroup,
    ...partial,
  };
}

function assertNoDuplicateBlurb(entity: RankingEntity, label: string) {
  const blurb = formatEntityIndexBlurb(entity);
  assert.ok(isEntityIndexBlurbText(blurb), `${label}: blurb should match index pattern`);
  assert.equal(
    entityNarrativeSummary(entity),
    undefined,
    `${label}: narrative summary must drop index blurb`,
  );

  const entertainment = resolveEntertainmentFacts(entity);
  if (entertainment?.synopsis) {
    assert.ok(
      !isEntityIndexBlurbText(entertainment.synopsis),
      `${label}: entertainment synopsis must not be index blurb (got: ${entertainment.synopsis})`,
    );
    assert.notEqual(
      entertainment.synopsis.trim(),
      blurb,
      `${label}: entertainment synopsis duplicates hero blurb`,
    );
  }

  const detail = resolveDetailFacts(entity);
  if (detail?.synopsis) {
    assert.ok(
      !isEntityIndexBlurbText(detail.synopsis),
      `${label}: detail synopsis must not be index blurb (got: ${detail.synopsis})`,
    );
    assert.notEqual(detail.synopsis.trim(), blurb, `${label}: detail synopsis duplicates hero blurb`);
  }

  const tv = buildTvProgramProfile(entity);
  if (tv?.plotSummary) {
    assert.ok(
      !isEntityIndexBlurbText(tv.plotSummary),
      `${label}: TV plot must not be index blurb (got: ${tv.plotSummary})`,
    );
    assert.notEqual(tv.plotSummary.trim(), blurb, `${label}: TV plot duplicates hero blurb`);
  }
}

const cases: RankingEntity[] = [
  sample({
    name: "볼빨간사춘기",
    slug: "볼빨간사춘기",
    type: "idol",
    rank: 999,
    fluctuationRate: -2.24,
    summary: "볼빨간사춘기는 엔터 종합 기준 999위입니다. 등락 -2.24%.",
  }),
  sample({
    name: "볼빨간사춘기",
    slug: "볼빨간사춘기-dup",
    type: "idol",
    summary:
      "볼빨간사춘기는 엔터 종합 기준 999위입니다. 등락 -2.24%. / 볼빨간사춘기는 엔터 종합 기준 999위입니다. 등락 -2.24%.",
  }),
  sample({
    name: "김호중",
    slug: "김호중",
    type: "celeb",
    tags: ["live-chart", "가수"],
    rank: 12,
    fluctuationRate: 3.1,
    summary: "김호중은 엔터 종합 기준 12위입니다. 등락 3.10%.",
  }),
  sample({
    name: "선재 업고 튀어",
    slug: "선재-업고-튀어",
    type: "drama",
    tags: ["live-chart", "tvN"],
    heatmapGroup: "TV 시청률",
    rank: 3,
    fluctuationRate: 1.2,
    summary: "선재 업고 튀어는 엔터 종합 기준 3위입니다. 등락 1.20%.",
  }),
  sample({
    name: "기본소득당",
    slug: "기본소득당",
    type: "issue",
    tags: ["live-chart"],
    sourceChannel: "politics",
    rank: 5,
    fluctuationRate: -0.5,
    summary: "기본소득당은 정치 종합 기준 5위입니다. 등락 -0.50%.",
  }),
];

assert.equal(
  isEntityIndexBlurbText("진짜 줄거리입니다. 소속사는 예시입니다."),
  false,
  "plain synopsis is not an index blurb",
);
assert.ok(
  entityNarrativeSummary({ summary: "멤버 구성과 최근 활동을 요약한 프로필입니다." }),
  "real narrative must pass through",
);

for (const entity of cases) {
  assertNoDuplicateBlurb(entity, entity.slug);
}

console.log(`index-blurb dedupe OK (${cases.length} entities)`);
