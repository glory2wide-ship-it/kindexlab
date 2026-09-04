/**
 * Purge + regenerate "오늘의 분석" for entertainment 아이돌 팬덤 화력 → 뉴진스.
 *
 *   npx tsx --env-file=.env.local scripts/regenerate-kpop-newjeans-analysis.ts
 */
import { refreshAnalysis } from "../src/lib/analysis/pipeline";
import { deleteAnalysis, readAnalysis } from "../src/lib/analysis/store";
import { analysisProvider, ANALYSIS_LLM, analysisLlmConfigured } from "../src/lib/analysis/chain/llm";
import { usesBriefingAnalysisPrompt } from "../src/lib/analysis/briefing-boards";
import { getRankings } from "../src/lib/api";
import { boardRowSlug, rankRowsToEntities, toHeatmapPayload } from "../src/lib/boards/heatmap";
import { getBoard } from "../src/lib/boards/registry";
import { readBoard } from "../src/lib/boards/store";

const BOARD_SLUG = "kpop-fandom-power";
const NAME_NEEDLE = "뉴진스";

async function main() {
  console.log(
    `[llm] configured=${analysisLlmConfigured()} provider=${analysisProvider()} draft=${ANALYSIS_LLM.draftModel()}`,
  );
  if (!analysisLlmConfigured()) {
    throw new Error("GEMINI_API_KEY is required for 오늘의 분석 generation");
  }

  const def = getBoard(BOARD_SLUG);
  if (!def) throw new Error(`board missing: ${BOARD_SLUG}`);

  const cached = await readBoard(BOARD_SLUG);
  if (!cached) throw new Error(`cached board missing: ${BOARD_SLUG}`);
  const ranking = cached.ranking ?? [];
  const row =
    ranking.find((item) => item.name === NAME_NEEDLE) ??
    ranking.find((item) => item.name.includes(NAME_NEEDLE));
  if (!row) {
    console.log(
      `[ranking] ${ranking.length} rows: ${ranking
        .slice(0, 15)
        .map((item) => item.name)
        .join(", ")}`,
    );
    throw new Error(`${NAME_NEEDLE} not on ${BOARD_SLUG} ranking`);
  }

  const boardPayload = toHeatmapPayload(def, cached);
  const entity = rankRowsToEntities([row], boardPayload)[0];
  if (!entity) throw new Error("failed to build entity");

  const expectedSlug = boardRowSlug(BOARD_SLUG, row.name);
  if (entity.slug !== expectedSlug) {
    throw new Error(`slug mismatch: ${entity.slug} vs ${expectedSlug}`);
  }

  console.log(`[target] ${entity.name}`);
  console.log(`[slug]   ${entity.slug}`);
  console.log(`[prompt] briefing-single-pass=${usesBriefingAnalysisPrompt(entity.slug)}`);

  const removed = await deleteAnalysis(entity.slug);
  console.log(`[purge]  → ${removed ? "removed" : "already absent"}`);

  const before = await readAnalysis(entity.slug);
  if (before) throw new Error("cache still present after delete");

  const market = await getRankings();
  const related = rankRowsToEntities(
    ranking.filter((item) => item.name !== row.name).slice(0, 6),
    boardPayload,
  );

  console.log("[generate] starting refreshAnalysis…");
  const entry = await refreshAnalysis({ entity, market, related });

  console.log(
    `[done] kind=${entry.provenance.kind} chars=${entry.article.characterCount} newsDocs=${entry.provenance.newsDocs} model=${entry.provenance.model ?? "-"}`,
  );
  console.log(`[title] ${entry.article.title}`);
  console.log(`[excerpt] ${entry.article.excerpt.slice(0, 160)}`);
  console.log(`[path] /ranking/${entity.slug}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
