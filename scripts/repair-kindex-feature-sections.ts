/**
 * Replace KinDex meta-definition boilerplate in ❺ with keyword-specific
 * signal paragraphs derived from board ranking rows.
 *
 *   npx tsx scripts/repair-kindex-feature-sections.ts
 *   npx tsx scripts/repair-kindex-feature-sections.ts --slug=travel-government-grant-ranking--한국관광공사-웰니스관광-클러스터
 */
import { writeAnalysis, type CachedAnalysis } from "../src/lib/analysis/store";
import {
  buildKindexFeatureParagraph,
  extractStoryBeatsFromSections,
  isKindexFeatureSectionHeading,
  isUnusableKindexFeatureBody,
  KINDEX_FEATURE_META_BOILERPLATE,
} from "../src/lib/editorial/tense-rules";
import { stripRowQualifier } from "../src/lib/boards/heatmap";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

function flag(name: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match?.slice(name.length + 3);
}

function boardSlugFromAnalysisSlug(slug: string): string | undefined {
  const idx = slug.indexOf("--");
  return idx > 0 ? slug.slice(0, idx) : undefined;
}

async function loadBoardRankings(): Promise<Map<string, Array<{ rank: number; name: string; changeRate: number; note: string }>>> {
  const file = path.join(process.cwd(), "src/data/boards/cache.json");
  const parsed = JSON.parse(await readFile(file, "utf8")) as {
    entries?: Array<{
      slug: string;
      ranking?: Array<{ rank: number; name: string; changeRate: number; note: string }>;
    }>;
  };
  const map = new Map<string, Array<{ rank: number; name: string; changeRate: number; note: string }>>();
  for (const entry of parsed.entries ?? []) {
    if (entry?.slug && entry.ranking?.length) map.set(entry.slug, entry.ranking);
  }
  return map;
}

function signalFactsForSlug(
  analysisSlug: string,
  keyword: string,
  boards: Map<string, Array<{ rank: number; name: string; changeRate: number; note: string }>>,
): string[] {
  const boardSlug = boardSlugFromAnalysisSlug(analysisSlug);
  const ranking = boardSlug ? boards.get(boardSlug) : undefined;
  if (!ranking?.length) return [];

  const focusCore = stripRowQualifier(keyword).trim() || keyword;
  const row =
    ranking.find((item) => item.name === keyword) ||
    ranking.find((item) => stripRowQualifier(item.name) === focusCore) ||
    ranking.find((item) => item.name.includes(focusCore) || focusCore.includes(stripRowQualifier(item.name)));

  const facts: string[] = [];
  if (row) {
    const name = stripRowQualifier(row.name);
    const particle = /[가-힣]$/.test(name)
      ? (name.charCodeAt(name.length - 1) - 0xac00) % 28 === 0
        ? "는"
        : "은"
      : "는";
    facts.push(`${name}${particle} 해당 히트맵에서 ${row.rank}위에 있습니다.`);
    if (row.changeRate !== 0) {
      facts.push(
        `직전 대비 변동률은 ${row.changeRate > 0 ? "+" : ""}${row.changeRate.toFixed(2)}%입니다.`,
      );
    } else {
      facts.push(`직전 대비 순위 변동은 정체(0%)입니다.`);
    }
    if (row.note?.trim()) {
      const note = row.note.trim().replace(/\.$/, "");
      facts.push(`${note}입니다.`);
    }
  }

  const peers = ranking
    .filter((item) => item.name !== row?.name)
    .slice(0, 3)
    .map((item) => `${stripRowQualifier(item.name)}(${item.rank}위)`);
  if (peers.length) {
    facts.push(`같은 보드 상위권에는 ${peers.join(", ")} 등이 함께 올라와 있습니다.`);
  }
  return facts;
}

function patchEntry(
  entry: CachedAnalysis,
  boards: Map<string, Array<{ rank: number; name: string; changeRate: number; note: string }>>,
): { entry: CachedAnalysis; changed: boolean } {
  const sections = entry.article?.sections ?? [];
  const kindex = sections.find((section) => isKindexFeatureSectionHeading(section.heading));
  const body = (kindex?.paragraphs ?? []).join(" ").trim();
  const forceBroken = /습니습니다/.test(body);
  if (!forceBroken && !isUnusableKindexFeatureBody(body)) {
    return { entry, changed: false };
  }

  const keyword = entry.keyword || entry.article.focusKeyword || entry.slug;
  const paragraph = buildKindexFeatureParagraph({
    keyword,
    signalFacts: signalFactsForSlug(entry.slug, keyword, boards),
    storyBeats: extractStoryBeatsFromSections(sections),
  });

  const nextSections = sections.map((section) =>
    isKindexFeatureSectionHeading(section.heading)
      ? { ...section, paragraphs: [paragraph] }
      : section,
  );

  let bodyMarkdown = entry.article.bodyMarkdown;
  if (bodyMarkdown?.includes(KINDEX_FEATURE_META_BOILERPLATE)) {
    bodyMarkdown = bodyMarkdown.split(KINDEX_FEATURE_META_BOILERPLATE).join(paragraph);
  } else if (bodyMarkdown && body && body !== paragraph) {
    bodyMarkdown = bodyMarkdown.split(body).join(paragraph);
  }

  return {
    changed: true,
    entry: {
      ...entry,
      article: {
        ...entry.article,
        sections: nextSections,
        ...(bodyMarkdown ? { bodyMarkdown } : {}),
      },
    },
  };
}

async function main() {
  const onlySlug = flag("slug");
  const boards = await loadBoardRankings();
  const dir = path.join(process.cwd(), "src/data/analysis/entries");
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json"));

  let scanned = 0;
  let repaired = 0;
  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(dir, file), "utf8")) as CachedAnalysis;
    if (!raw?.slug) continue;
    if (onlySlug && raw.slug !== onlySlug) continue;
    scanned += 1;
    const { entry, changed } = patchEntry(raw, boards);
    if (!changed) continue;
    await writeAnalysis(entry);
    repaired += 1;
    console.log(`[repaired] ${entry.slug}`);
  }
  console.log(`[done] scanned=${scanned} repaired=${repaired}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
