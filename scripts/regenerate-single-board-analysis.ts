/**
 * Purge + regenerate one Today's Analysis row from a heatmap board.
 *
 *   npx tsx --env-file=.env.local scripts/regenerate-single-board-analysis.ts --board=trot-kayo-fandom-power --name=조용필
 */
import { refreshAnalysis } from "../src/lib/analysis/pipeline";
import { deleteAnalysis, readAnalysis } from "../src/lib/analysis/store";
import { analysisProvider, ANALYSIS_LLM, analysisLlmConfigured } from "../src/lib/analysis/chain/llm";
import { usesBriefingAnalysisPrompt } from "../src/lib/analysis/briefing-boards";
import { getRankings } from "../src/lib/api";
import { boardRowSlug, rankRowsToEntities, toHeatmapPayload } from "../src/lib/boards/heatmap";
import { getBoard } from "../src/lib/boards/registry";
import { readBoard } from "../src/lib/boards/store";

function flag(name: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match?.slice(name.length + 3);
}

async function main() {
  const boardSlug = flag("board");
  const nameNeedle = flag("name");
  if (!boardSlug || !nameNeedle) {
    throw new Error("--board=<slug> and --name=<keyword> are required");
  }

  console.log(
    `[llm] configured=${analysisLlmConfigured()} provider=${analysisProvider()} draft=${ANALYSIS_LLM.draftModel()}`,
  );
  if (!analysisLlmConfigured()) {
    throw new Error("GEMINI_API_KEY is required for 오늘의 분석 generation");
  }

  const def = getBoard(boardSlug);
  if (!def) throw new Error(`board missing: ${boardSlug}`);

  const cached = await readBoard(boardSlug);
  if (!cached) throw new Error(`cached board missing: ${boardSlug}`);
  const ranking = cached.ranking ?? [];
  const row =
    ranking.find((item) => item.name === nameNeedle) ??
    ranking.find((item) => item.name.includes(nameNeedle));
  if (!row) {
    console.log(
      `[ranking] ${ranking.length} rows: ${ranking
        .slice(0, 20)
        .map((item) => item.name)
        .join(", ")}`,
    );
    throw new Error(`${nameNeedle} not on ${boardSlug} ranking`);
  }

  const boardPayload = toHeatmapPayload(def, cached);
  const entity = rankRowsToEntities([row], boardPayload)[0];
  if (!entity) throw new Error("failed to build entity");

  const expectedSlug = boardRowSlug(boardSlug, row.name);
  if (entity.slug !== expectedSlug) {
    throw new Error(`slug mismatch: ${entity.slug} vs ${expectedSlug}`);
  }

  console.log(`[target] ${entity.name}`);
  console.log(`[slug]   ${entity.slug}`);
  console.log(`[prompt] briefing-single-pass=${usesBriefingAnalysisPrompt(entity.slug)}`);

  const removed = await deleteAnalysis(entity.slug);
  console.log(`[purge]  -> ${removed ? "removed" : "already absent"}`);

  const before = await readAnalysis(entity.slug);
  if (before) throw new Error("cache still present after delete");

  const market = await getRankings();
  const related = rankRowsToEntities(
    ranking.filter((item) => item.name !== row.name).slice(0, 6),
    boardPayload,
  );

  console.log("[generate] starting refreshAnalysis...");
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
