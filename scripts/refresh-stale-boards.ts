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
import { resetGeminiUsage, snapshotGeminiUsage } from "../src/lib/ops/gemini-usage";
import { digestFromBoardRefresh, persistOpsDigest } from "../src/lib/ops/ops-digest";
import { spawnSync } from "node:child_process";

function arg(name: string): string | undefined {
  const found = process.argv.find((item) => item.startsWith(`--${name}=`));
  return found?.split("=")[1];
}

function kstToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function refreshTargets(
  targets: Awaited<ReturnType<typeof pickStaleBoards>>,
): Promise<{ ok: number; fail: number }> {
  let ok = 0;
  let fail = 0;
  for (const [index, board] of targets.entries()) {
    try {
      const entry = await refreshBoard(board);
      const schema = describeDemographicSchema(entry.demographics);
      console.log(
        `[${index + 1}/${targets.length}] ${entry.slug} · ${entry.provenance.kind} · ` +
          `${entry.ranking.length}행 · demo=${entry.provenance.demographicsFromLlm ? "llm" : "derived"} ` +
          `complete=${schema.complete} · docs=${entry.provenance.newsDocs} · ${entry.provenance.buildMs}ms`,
      );
      ok += 1;
    } catch (error) {
      fail += 1;
      console.error(`[${index + 1}/${targets.length}] FAIL ${board.slug}`, error);
    }
  }
  return { ok, fail };
}

async function main() {
  resetGeminiUsage();
  const limit = Number.parseInt(arg("limit") ?? "4", 10);
  const targets = await pickStaleBoards(Number.isFinite(limit) && limit > 0 ? limit : 4);
  console.log(`refreshing ${targets.length} boards (expired/missing only)`);

  if (!targets.length) {
    console.log("nothing due — skip publish");
    return;
  }

  const useBatch = geminiBatchEnabled() && briefingProvider() === "gemini";
  let counts = { ok: 0, fail: 0 };
  if (useBatch) {
    console.log("gemini batch mode on (−50%)");
    counts = await withGeminiBatchChat(() => refreshTargets(targets));
  } else {
    counts = await refreshTargets(targets);
  }

  const publish = spawnSync("npx", ["tsx", "scripts/publish-boards.ts", "--kind=chain"], {
    stdio: "inherit",
    env: process.env,
  });
  if (publish.status !== 0) process.exit(publish.status ?? 1);

  const cost = snapshotGeminiUsage();
  try {
    const digestPath = await persistOpsDigest(
      digestFromBoardRefresh({
        editionDate: kstToday(),
        generatedAt: new Date().toISOString(),
        boardsRefreshed: counts.ok,
        ok: counts.ok,
        fail: counts.fail,
        cost,
        notes: [
          `limit=${limit}`,
          `geminiBatch=${useBatch}`,
          `targets=${targets.length}`,
        ],
      }),
    );
    console.log(`[ops] digest ${digestPath}`);
  } catch (error) {
    console.warn("[ops] digest persist failed", error);
  }
}

void main();
