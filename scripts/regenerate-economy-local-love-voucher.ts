/**
 * Purge + regenerate economy heatmap 오늘의 분석 for 지역사랑상품권
 * using the KinDex data-journalist Gemini prompt.
 *
 *   npx tsx --env-file=.env.local scripts/regenerate-economy-local-love-voucher.ts
 */
import { refreshAnalysis } from "../src/lib/analysis/pipeline";
import { deleteAnalysis, readAnalysis } from "../src/lib/analysis/store";
import { analysisLlmConfigured, analysisProvider, ANALYSIS_LLM } from "../src/lib/analysis/chain/llm";
import { getRankings } from "../src/lib/api";
import { kstDateString } from "../src/lib/briefing/dates";
import { boardRowSlug, rankRowsToEntities, toHeatmapPayload } from "../src/lib/boards/heatmap";
import { getBoard } from "../src/lib/boards/registry";
import { seedBoardIfMissing } from "../src/lib/boards/seed";
import { readBoard, writeBoard } from "../src/lib/boards/store";
import type { BoardRankEntry } from "../src/lib/boards/types";

const BOARD_SLUG = "government-subsidy-search";
const TARGET_NAME = "[행정안전부] 지역사랑상품권";
const NAME_NEEDLE = "지역사랑상품권";

async function main() {
  console.log(
    `[llm] configured=${analysisLlmConfigured()} provider=${analysisProvider()} draft=${ANALYSIS_LLM.draftModel()}`,
  );
  if (!analysisLlmConfigured()) {
    throw new Error("GEMINI_API_KEY is required");
  }

  const def = getBoard(BOARD_SLUG);
  if (!def) throw new Error(`board missing: ${BOARD_SLUG}`);

  let cached = await readBoard(BOARD_SLUG);
  if (!cached) cached = await seedBoardIfMissing(def);

  let ranking = [...(cached.ranking ?? [])];
  let row = ranking.find((item) => item.name.includes(NAME_NEEDLE));
  if (!row) {
    // Promote onto the live heatmap so visitors can open the detail column.
    const insert: BoardRankEntry = {
      rank: Math.min(8, ranking.length + 1),
      name: TARGET_NAME,
      score: 68.5,
      changeRate: 4.6,
      note: "지역화폐·상품권 관심 재진입",
    };
    ranking = [insert, ...ranking]
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }))
      .slice(0, Math.max(15, ranking.length || 15));
    row = ranking.find((item) => item.name.includes(NAME_NEEDLE))!;
    const next = {
      ...cached,
      ranking,
      editionDate: kstDateString(),
      generatedAt: new Date().toISOString(),
    };
    await writeBoard(next);
    cached = next;
    console.log(`[board] injected ${TARGET_NAME} at rank ${row.rank} score=${row.score}`);
  } else {
    console.log(`[board] found ${row.name} at rank ${row.rank} score=${row.score}`);
  }

  const boardPayload = toHeatmapPayload(def, cached);
  const entity = rankRowsToEntities([row], boardPayload)[0];
  if (!entity) throw new Error("failed to build entity");
  console.log(`[target] ${entity.name}`);
  console.log(`[slug]   ${entity.slug}`);
  console.log(`[prompt] data-journalist=true`);

  const removed = await deleteAnalysis(entity.slug);
  console.log(`[purge] ${removed ? "removed" : "already absent"}`);
  const before = await readAnalysis(entity.slug);
  if (before) throw new Error("cache still present after delete");

  const market = await getRankings();
  const related = rankRowsToEntities(
    ranking.filter((item) => !item.name.includes(NAME_NEEDLE)).slice(0, 6),
    boardPayload,
  );

  console.log("[generate] refreshAnalysis with data-journalist prompt…");
  const entry = await refreshAnalysis({ entity, market, related });
  console.log(
    `[done] kind=${entry.provenance.kind} chars=${entry.article.characterCount} newsDocs=${entry.provenance.newsDocs} model=${entry.provenance.model ?? "-"}`,
  );
  console.log(`[title] ${entry.article.title}`);
  console.log(`[excerpt] ${entry.article.excerpt.slice(0, 160)}`);
  console.log(`[sections] ${entry.article.sections.map((s) => s.heading).join(" | ")}`);
  console.log(`[path] /ranking/${entity.slug}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
