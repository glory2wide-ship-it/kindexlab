/**
 * Cron / CI helper: refresh the N stalest boards, then write published.json.
 *
 *   npx tsx --env-file=.env.local scripts/refresh-stale-boards.ts
 *   npx tsx --env-file=.env.local scripts/refresh-stale-boards.ts --limit=4
 */
import { describeDemographicSchema } from "../src/lib/boards/demographics";
import { pickStaleBoards, refreshBoard } from "../src/lib/boards/pipeline";
import { spawnSync } from "node:child_process";

function arg(name: string): string | undefined {
  const found = process.argv.find((item) => item.startsWith(`--${name}=`));
  return found?.split("=")[1];
}

async function main() {
  const limit = Number.parseInt(arg("limit") ?? "4", 10);
  const targets = await pickStaleBoards(Number.isFinite(limit) && limit > 0 ? limit : 4);
  console.log(`refreshing ${targets.length} boards`);

  for (const [index, board] of targets.entries()) {
    const entry = await refreshBoard(board);
    const schema = describeDemographicSchema(entry.demographics);
    console.log(
      `[${index + 1}/${targets.length}] ${entry.slug} · ${entry.provenance.kind} · ` +
        `${entry.ranking.length}행 · demo=${entry.provenance.demographicsFromLlm ? "llm" : "derived"} ` +
        `complete=${schema.complete} · docs=${entry.provenance.newsDocs} · ${entry.provenance.buildMs}ms`,
    );
  }

  const publish = spawnSync("npx", ["tsx", "scripts/publish-boards.ts", "--kind=chain"], {
    stdio: "inherit",
    env: process.env,
  });
  if (publish.status !== 0) process.exit(publish.status ?? 1);
}

void main();
