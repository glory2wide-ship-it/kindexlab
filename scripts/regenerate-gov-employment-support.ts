/**
 * Purge + regenerate 오늘의 분석 for politics 정부 지원금 → 국민취업지원제도.
 *
 *   npx tsx --env-file=.env.local scripts/regenerate-gov-employment-support.ts
 */
import { listHeatmapAnalysisTargets } from "../src/lib/analysis/heatmap-inventory";
import { refreshAnalysis } from "../src/lib/analysis/pipeline";
import { deleteAnalysis, readAnalysis } from "../src/lib/analysis/store";
import { usesBriefingAnalysisPrompt } from "../src/lib/analysis/briefing-boards";
import { getRankings } from "../src/lib/api";

const BOARD_SLUG = "government-support-fund";
const NAME_NEEDLE = "국민취업지원제도";

async function main() {
  const targets = await listHeatmapAnalysisTargets({
    channel: "politics",
    boardSlug: BOARD_SLUG,
    seedMissing: true,
  });
  const target = targets.find((item) => item.entity.name.includes(NAME_NEEDLE));
  if (!target) {
    throw new Error(
      `${NAME_NEEDLE} not in heatmap inventory for ${BOARD_SLUG} (${targets.length} tiles)`,
    );
  }

  const { entity, related } = target;
  console.log(`[target] ${entity.name}`);
  console.log(`[slug]   ${entity.slug}`);
  console.log(`[prompt] briefing-single-pass=${usesBriefingAnalysisPrompt(entity.slug)}`);

  const removed = await deleteAnalysis(entity.slug);
  console.log(`[purge]  local/remote delete → ${removed ? "removed or requested" : "already absent"}`);

  const before = await readAnalysis(entity.slug);
  if (before) throw new Error("cache still present after delete");

  const market = await getRankings();
  console.log("[generate] starting refreshAnalysis…");
  const entry = await refreshAnalysis({ entity, market, related });

  console.log(
    `[done] kind=${entry.provenance.kind} chars=${entry.article.characterCount} newsDocs=${entry.provenance.newsDocs} model=${entry.provenance.model ?? "-"}`,
  );
  console.log(`[title] ${entry.article.title}`);
  console.log(`[excerpt] ${entry.article.excerpt.slice(0, 160)}`);
  console.log(`[edition] ${entry.editionDate}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
