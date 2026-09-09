/**
 * Force-refresh 웰니스관광 클러스터 KinDex ❺ and bump generatedAt
 * so long-lived Next memory picks up the shard.
 */
import { readAnalysis, writeAnalysis } from "../src/lib/analysis/store";
import {
  buildKindexFeatureParagraph,
  isKindexFeatureSectionHeading,
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
  const peers = ranking
    .filter((item) => item.name !== row?.name)
    .slice(0, 3)
    .map((item) => `${stripRowQualifier(item.name)}(${item.rank}위)`);
  if (peers.length) {
    facts.push(`같은 보드 상위권에는 ${peers.join(", ")} 등이 함께 올라와 있습니다.`);
  }

  const paragraph = buildKindexFeatureParagraph({ keyword: focus, signalFacts: facts });
  console.log("[❺]", paragraph);

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
