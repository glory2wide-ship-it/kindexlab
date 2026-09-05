/**
 * Force-regenerate Today's Analysis for every row on one heatmap board.
 *
 *   npx tsx --env-file=.env.local scripts/regenerate-board-analyses.ts --board=trot-kayo-fandom-power
 */
import { listHeatmapAnalysisTargets } from "../src/lib/analysis/heatmap-inventory";
import { runHeatmapAnalysisOvernight } from "../src/lib/analysis/overnight-batch";
import { kstDateString } from "../src/lib/briefing/dates";
import { getRankings } from "../src/lib/api";

function flag(name: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match?.slice(name.length + 3);
}

async function main() {
  const boardSlug = flag("board");
  if (!boardSlug) {
    throw new Error("--board=<slug> is required");
  }

  const editionDate = flag("date") ?? kstDateString();
  const all = await listHeatmapAnalysisTargets();
  const targets = all.filter((item) => item.boardSlug === boardSlug);
  if (!targets.length) {
    throw new Error(`no heatmap analysis targets found for board: ${boardSlug}`);
  }

  console.log(`[inventory] board=${boardSlug} targets=${targets.length} edition=${editionDate}`);
  console.log(
    `[targets] ${targets.map((item) => `${item.entity.name} -> ${item.entity.slug}`).join(", ")}`,
  );

  const market = await getRankings();
  const run = await runHeatmapAnalysisOvernight(targets, {
    market,
    editionDate,
    force: true,
    onProgress: (item, position, total) => {
      const tag = item.ok ? "ok" : "fail";
      console.log(
        `[${position}/${total}] ${tag} ${item.keyword} (${item.kind ?? item.reason ?? "-"}) ${item.ms}ms`,
      );
    },
  });

  console.log(
    `[done] generated=${run.generated} failed=${run.failed} skipped=${run.skipped} batches=${run.batches} geminiBatch=${run.geminiBatch}`,
  );

  const failures = run.items.filter((item) => !item.ok);
  if (failures.length) {
    console.log(
      `[failed-items] ${failures.map((item) => `${item.keyword}: ${item.reason ?? "unknown"}`).join(" | ")}`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
