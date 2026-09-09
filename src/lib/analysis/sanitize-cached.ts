/**
 * Repair stale cached analysis bodies that still contain known editorial
 * defects (KinDex meta/rank-template ❺, identical 지원금 ❸/❹ headings).
 * Runs at read time so production Supabase rows fix themselves on deploy
 * without waiting for a full regenerate.
 */
import type { CachedAnalysis } from "@/lib/analysis/store";
import { stripRowQualifier } from "@/lib/boards/heatmap";
import {
  buildKindexFeatureParagraph,
  extractStoryBeatsFromSections,
  isKindexFeatureSectionHeading,
  isUnusableKindexFeatureBody,
  scrubSectionHeadingNoise,
} from "@/lib/editorial/tense-rules";
import type { RankingEntity } from "@/lib/types";

const GENERIC_GRANT_READER = "지원금을 신청하는 방법";
const GENERIC_GRANT_OUTLOOK = "다음 모집·쿠폰 일정을 확인하는 법";

function focusLabel(entry: CachedAnalysis, entity?: RankingEntity): string {
  const raw =
    entity?.name ||
    entry.keyword ||
    entry.article.focusKeyword ||
    entry.slug.split("--").slice(1).join("--") ||
    "이 사업";
  return stripRowQualifier(raw) || raw;
}

function signalFactsFromEntity(keyword: string, entity?: RankingEntity): string[] {
  if (!entity) return [];
  const facts: string[] = [];
  const name = stripRowQualifier(entity.name) || keyword;
  facts.push(`${name}는 해당 히트맵에서 ${entity.rank}위에 있습니다.`);
  const delta = entity.previousRank - entity.rank;
  if (delta !== 0) {
    facts.push(
      `직전 ${entity.previousRank}위에서 ${entity.rank}위로 ${delta > 0 ? "올랐습니다" : "내렸습니다"}.`,
    );
  } else {
    facts.push("직전 대비 순위 변동은 정체(0%)입니다.");
  }
  if (entity.summary?.trim()) {
    facts.push(entity.summary.trim().replace(/\.$/, "") + "입니다.");
  }
  return facts;
}

export function sanitizeCachedAnalysisArticle(
  entry: CachedAnalysis,
  entity?: RankingEntity,
): CachedAnalysis {
  const focus = focusLabel(entry, entity);
  let changed = false;
  const storyBeats = extractStoryBeatsFromSections(entry.article.sections);

  const sections = entry.article.sections.map((section) => {
    let heading = section.heading;
    let paragraphs = section.paragraphs;

    const clean = scrubSectionHeadingNoise(heading);
    if (clean === GENERIC_GRANT_READER) {
      heading = heading.replace(clean, `${focus} 신청·자격에서 놓치기 쉬운 점`);
      changed = true;
    } else if (clean === GENERIC_GRANT_OUTLOOK) {
      heading = heading.replace(clean, `${focus} 다음 모집·지급 일정을 읽는 법`);
      changed = true;
    }

    if (isKindexFeatureSectionHeading(heading)) {
      const body = paragraphs.join(" ").trim();
      if (isUnusableKindexFeatureBody(body)) {
        paragraphs = [
          buildKindexFeatureParagraph({
            keyword: focus,
            signalFacts: signalFactsFromEntity(focus, entity),
            storyBeats,
          }),
        ];
        changed = true;
      }
    }

    return heading === section.heading && paragraphs === section.paragraphs
      ? section
      : { ...section, heading, paragraphs };
  });

  if (!changed) return entry;
  return {
    ...entry,
    article: { ...entry.article, sections },
  };
}
