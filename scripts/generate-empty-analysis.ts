/**
 * Generate only empty Top-N 오늘의 분석 slots (Gemini quality miss).
 * Warm columns within the 2-day cycle are skipped by overnight policy.
 */
import { listHeatmapAnalysisTargets } from "../src/lib/analysis/heatmap-inventory";
import { runHeatmapAnalysisOvernight } from "../src/lib/analysis/overnight-batch";
import { readAnalysis } from "../src/lib/analysis/store";
import { isGeminiAnalysis } from "../src/lib/analysis/quality";
import { isEligibleAnalysisBackfill } from "../src/lib/analysis/generation-policy";
import { getRankings } from "../src/lib/api";
import { kstDateString } from "../src/lib/briefing/dates";
import { resetGeminiUsage, snapshotGeminiUsage, formatKrw } from "../src/lib/ops/gemini-usage";

async function main() {
  const editionDate = process.argv.find((a) => a.startsWith("--date="))?.slice(7) ?? kstDateString();
  const dry = process.argv.includes("--dry");
  const all = await listHeatmapAnalysisTargets({ seedMissing: true });
  const empty = [];
  for (const t of all) {
    const cached = await readAnalysis(t.entity.slug);
    const ok =
      Boolean(cached) &&
      isGeminiAnalysis(cached) &&
      isEligibleAnalysisBackfill(cached);
    if (!ok) empty.push(t);
  }
  console.log(`[empty] ${empty.length}/${all.length} · edition=${editionDate}`);
  for (const [i, t] of empty.entries()) {
    console.log(`  ${String(i + 1).padStart(3)}. [${t.channel}/${t.boardSlug}] ${t.entity.name}`);
  }
  if (dry || empty.length === 0) return;

  resetGeminiUsage(process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash");
  const market = await getRankings();
  const started = Date.now();
  const run = await runHeatmapAnalysisOvernight(empty, {
    market,
    editionDate,
    force: false,
    onProgress: (item, position, total) => {
      const tag = item.skipped ? "skip" : item.ok ? "ok" : "fail";
      console.log(
        `[${position}/${total}] ${tag} ${item.keyword} (${item.kind ?? item.reason ?? "-"}) ${item.ms}ms`,
      );
    },
  });
  const cost = snapshotGeminiUsage();
  console.log(
    `[done] generated=${run.generated} skipped=${run.skipped} failed=${run.failed} · ${Math.round((Date.now() - started) / 1000)}s · ~${formatKrw(cost.estimatedKrw)}`,
  );
  if (run.failed) {
    for (const item of run.items.filter((i) => !i.ok)) {
      console.log(`  FAIL ${item.keyword}: ${item.reason}`);
    }
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
