/**
 * Builds ranking boards outside the dev server, which is the only way to get a
 * cold cache: the Next process keeps its own in-memory map, so deleting the JSON
 * file alone does not force a rebuild.
 *
 *   npx tsx --env-file=.env.local scripts/generate-boards.ts            # all boards
 *   npx tsx --env-file=.env.local scripts/generate-boards.ts --limit=3
 *   npx tsx --env-file=.env.local scripts/generate-boards.ts --slug=kpop-fandom-power
 */
import { describeDemographicSchema } from "../src/lib/boards/demographics";
import { refreshBoard } from "../src/lib/boards/pipeline";
import { BOARDS, getBoard, isDeskBoard } from "../src/lib/boards/registry";
import { clearBoards } from "../src/lib/boards/store";
import type { BoardDefinition } from "../src/lib/boards/types";

function arg(name: string): string | undefined {
  const found = process.argv.find((item) => item.startsWith(`--${name}=`));
  return found?.split("=")[1];
}

async function main() {
  const slug = arg("slug");
  const limit = Number.parseInt(arg("limit") ?? "", 10);

  let targets: BoardDefinition[];
  if (slug) {
    const board = getBoard(slug);
    if (!board) throw new Error(`Unknown board: ${slug}`);
    targets = [board];
  } else {
    targets = Number.isFinite(limit) && limit > 0 ? BOARDS.slice(0, limit) : BOARDS;
  }
  targets = targets.filter((board) => !isDeskBoard(board));

  if (process.argv.includes("--reset")) {
    const removed = await clearBoards();
    console.log(`purged ${removed} cached boards`);
  }

  let chained = 0;
  let fromLlm = 0;

  for (const [index, board] of targets.entries()) {
    const entry = await refreshBoard(board);
    if (entry.provenance.kind === "chain") chained += 1;
    if (entry.provenance.demographicsFromLlm) fromLlm += 1;
    const schema = describeDemographicSchema(entry.demographics);
    const scoreMax = Math.max(0, ...entry.ranking.map((row) => row.score));
    console.log(
      `[${index + 1}/${targets.length}] ${entry.slug} · ${entry.provenance.kind} · ` +
        `${entry.ranking.length}행 · ${entry.report.characterCount}자 · ` +
        `demo=${entry.provenance.demographicsFromLlm ? "llm" : "derived"} ` +
        `complete=${schema.complete} · gender={${schema.gender}} · age={${schema.age}} · ` +
        `scoreMax=${scoreMax.toFixed(2)} · pump=${entry.pump ? "yes" : "no"} · ` +
        `docs=${entry.provenance.newsDocs} · ${entry.provenance.buildMs}ms`,
    );
  }

  console.log(`\n${targets.length} built · ${chained} chained · ${fromLlm} demographics from LLM`);
}

void main();
