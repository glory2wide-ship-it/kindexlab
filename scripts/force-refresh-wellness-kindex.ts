/**
 * Force-refresh 웰니스관광 클러스터 KinDex ❺ using ❶–❹ story beats
 * (not rank-only glue) and bump generatedAt so memory caches refresh.
 */
import { readAnalysis, writeAnalysis } from "../src/lib/analysis/store";
import {
  buildKindexFeatureParagraph,
  extractStoryBeatsFromSections,
  isKindexFeatureSectionHeading,
  isUnusableKindexFeatureBody,
} from "../src/lib/editorial/tense-rules";
import { stripRowQualifier } from "../src/lib/boards/heatmap";
import { readFile } from "node:fs/promises";

async function main() {
  const slug = "travel-government-grant-ranking--한국관광공사-웰니스관광-클러스터";
  const entry = await readAnalysis(slug);
  if (!entry) throw new Error(`missing ${slug}`);

  const boards = JSON.parse(await readFile("src/data/boards/cache.json", "utf8")) as {
    entries?: Array<{
      slug: string;
      ranking?: Array<{ rank: number; name: string; changeRate: number; note: string }>;
    }>;
  };
  const board = (boards.entries || []).find((item) => item.slug === "travel-government-grant-ranking");
  const ranking = board?.ranking || [];
  const keyword = entry.keyword || "웰니스관광 클러스터";
  const focus = stripRowQualifier(keyword);
  const row = ranking.find((item) => item.name.includes("웰니스"));

  const facts: string[] = [];
  if (row) {
    facts.push(`${stripRowQualifier(row.name)}는 해당 히트맵에서 ${row.rank}위에 있습니다.`);
    facts.push(
      row.changeRate === 0
        ? "직전 대비 순위 변동은 정체(0%)입니다."
        : `직전 대비 변동률은 ${row.changeRate > 0 ? "+" : ""}${row.changeRate.toFixed(2)}%입니다.`,
    );
    if (row.note?.trim()) facts.push(`${row.note.replace(/\.$/, "")}입니다.`);
  }

  const storyBeats = extractStoryBeatsFromSections(entry.article.sections);
  const paragraph = buildKindexFeatureParagraph({
    keyword: focus,
    signalFacts: facts,
    storyBeats,
  });
  console.log("[storyBeats]", storyBeats.slice(0, 4));
  console.log("[❺]", paragraph);
  console.log("[usable]", !isUnusableKindexFeatureBody(paragraph));

  const sections = entry.article.sections.map((section) =>
    isKindexFeatureSectionHeading(section.heading)
      ? { ...section, paragraphs: [paragraph] }
      : section,
  );

  const now = new Date().toISOString();
  const result = await writeAnalysis({
    ...entry,
    generatedAt: now,
    article: { ...entry.article, sections },
  });
  console.log("[write]", result);

  const verify = await readAnalysis(slug);
  const kindex = verify?.article.sections.find((section) =>
    isKindexFeatureSectionHeading(section.heading),
  );
  console.log("[verify]", kindex?.paragraphs?.[0]);
  console.log("[generatedAt]", verify?.generatedAt);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
