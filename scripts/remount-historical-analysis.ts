/**
 * Remount historical Gemini 오늘의 분석 onto live entity slugs that are empty.
 *   npx tsx scripts/remount-historical-analysis.ts
 *   npx tsx scripts/remount-historical-analysis.ts --dry-run
 */
import { getRankings } from "../src/lib/api";
import { isGeminiAnalysis } from "../src/lib/analysis/quality";
import {
  hasUsableAnalysisBody,
  readAnalysis,
  readAnalysisForEntity,
  remountAnalysisForEntity,
  writeAnalysis,
} from "../src/lib/analysis/store";

const DRY = process.argv.includes("--dry-run");

async function main() {
  const market = await getRankings();
  let filled = 0;
  let remounted = 0;
  let skipped = 0;
  const samples: string[] = [];

  for (const entity of market.items) {
    const exact = await readAnalysis(entity.slug);
    if (exact && isGeminiAnalysis(exact) && hasUsableAnalysisBody(exact)) {
      filled += 1;
      continue;
    }
    const aliased = await readAnalysisForEntity(entity.slug, entity.name);
    if (!aliased || !isGeminiAnalysis(aliased) || !hasUsableAnalysisBody(aliased)) {
      skipped += 1;
      continue;
    }
    const next = remountAnalysisForEntity(aliased, entity.slug, entity.name);
    if (!DRY) {
      await writeAnalysis(next);
    }
    remounted += 1;
    if (samples.length < 25) {
      samples.push(`${entity.slug} <- ${aliased.slug}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun: DRY,
        entities: market.items.length,
        alreadyFilled: filled,
        remounted,
        stillEmpty: skipped,
        samples,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
