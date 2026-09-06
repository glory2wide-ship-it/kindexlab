/**
 * Purge + regenerate "오늘의 분석" for politics 정부 지원금 → 자녀장려금.
 *
 *   npx tsx --env-file=.env.local scripts/regenerate-gov-support-child-credit.ts
 */
import { refreshAnalysis } from "../src/lib/analysis/pipeline";
import { deleteAnalysis, readAnalysis } from "../src/lib/analysis/store";
import { usesBriefingAnalysisPrompt } from "../src/lib/analysis/briefing-boards";
import { getRankings } from "../src/lib/api";
import { boardRowSlug, rankRowsToEntities, toHeatmapPayload } from "../src/lib/boards/heatmap";
import { getBoard } from "../src/lib/boards/registry";
import { readBoard } from "../src/lib/boards/store";

const BOARD_SLUG = "government-support-fund";
const NAME_NEEDLE = "자녀장려금";

async function main() {
  const def = getBoard(BOARD_SLUG);
  if (!def) throw new Error(`board missing: ${BOARD_SLUG}`);

  const cached = await readBoard(BOARD_SLUG);
  if (!cached) throw new Error(`cached board missing: ${BOARD_SLUG}`);
  const ranking = cached.ranking ?? [];
  const row = ranking.find((item) => item.name.includes(NAME_NEEDLE));
  if (!row) throw new Error(`${NAME_NEEDLE} not on ${BOARD_SLUG} ranking (${ranking.length} rows)`);

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
  console.log(`[purge]  local/remote delete → ${removed ? "removed or requested" : "already absent"}`);

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
  console.log(`[excerpt] ${entry.article.excerpt.slice(0, 120)}…`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
