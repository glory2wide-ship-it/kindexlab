/**
 * Cron / CI helper: refresh expired/missing boards, then write published.json.
 *
 *   npx tsx --env-file=.env.local scripts/refresh-stale-boards.ts
 *   npx tsx --env-file=.env.local scripts/refresh-stale-boards.ts --limit=4
 *
 * Cost controls (CI): GEMINI_USE_BATCH, BOARDS_SKIP_POLISH, BOARDS_SKIP_PUMP,
 * BOARDS_TTL_HOURS, expired-only pickStaleBoards.
 */
import { describeDemographicSchema } from "../src/lib/boards/demographics";
import { pickStaleBoards, refreshBoard } from "../src/lib/boards/pipeline";
import { geminiBatchEnabled, briefingProvider } from "../src/lib/analysis/chain/llm";
import { withGeminiBatchChat } from "../src/lib/gemini/batch-chat";
import { spawnSync } from "node:child_process";

function arg(name: string): string | undefined {
  const found = process.argv.find((item) => item.startsWith(`--${name}=`));
  return found?.split("=")[1];
}

async function refreshTargets(
  targets: Awaited<ReturnType<typeof pickStaleBoards>>,
): Promise<void> {
  for (const [index, board] of targets.entries()) {
    const entry = await refreshBoard(board);
    const schema = describeDemographicSchema(entry.demographics);
    console.log(
      `[${index + 1}/${targets.length}] ${entry.slug} · ${entry.provenance.kind} · ` +
        `${entry.ranking.length}행 · demo=${entry.provenance.demographicsFromLlm ? "llm" : "derived"} ` +
        `complete=${schema.complete} · docs=${entry.provenance.newsDocs} · ${entry.provenance.buildMs}ms`,
    );
  }
}

async function main() {
  const limit = Number.parseInt(arg("limit") ?? "4", 10);
  const targets = await pickStaleBoards(Number.isFinite(limit) && limit > 0 ? limit : 4);
  console.log(`refreshing ${targets.length} boards (expired/missing only)`);

  if (!targets.length) {
    console.log("nothing due — skip publish");
    return;
  }

  const useBatch = geminiBatchEnabled() && briefingProvider() === "gemini";
  if (useBatch) {
    console.log("gemini batch mode on (−50%)");
    await withGeminiBatchChat(() => refreshTargets(targets));
  } else {
    await refreshTargets(targets);
  }

  const publish = spawnSync("npx", ["tsx", "scripts/publish-boards.ts", "--kind=chain"], {
    stdio: "inherit",
    env: process.env,
  });
  if (publish.status !== 0) process.exit(publish.status ?? 1);
}

void main();
