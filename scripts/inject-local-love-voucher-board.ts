/**
 * Inject [행정안전부] 지역사랑상품권 onto the economy government-subsidy-search board.
 */
import { kstDateString } from "../src/lib/briefing/dates";
import { getBoard } from "../src/lib/boards/registry";
import { seedBoardIfMissing } from "../src/lib/boards/seed";
import { readBoard, writeBoard } from "../src/lib/boards/store";
import type { BoardRankEntry } from "../src/lib/boards/types";

const BOARD_SLUG = "government-subsidy-search";
const TARGET_NAME = "[행정안전부] 지역사랑상품권";

async function main() {
  const def = getBoard(BOARD_SLUG);
  if (!def) throw new Error(`board missing: ${BOARD_SLUG}`);
  let cached = await readBoard(BOARD_SLUG);
  if (!cached) cached = await seedBoardIfMissing(def);
  let ranking = [...(cached.ranking ?? [])];
  const existing = ranking.find((row) => row.name.includes("지역사랑상품권"));
  if (existing) {
    console.log(`[ok] already present rank=${existing.rank} score=${existing.score}`);
    return;
  }
  const insert: BoardRankEntry = {
    rank: 1,
    name: TARGET_NAME,
    score: 72.4,
    changeRate: 5.2,
    note: "지역화폐·상품권 관심",
  };
  ranking = [insert, ...ranking]
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({ ...item, rank: index + 1 }))
    .slice(0, 15);
  await writeBoard({
    ...cached,
    ranking,
    editionDate: kstDateString(),
    generatedAt: new Date().toISOString(),
  });
  const row = ranking.find((item) => item.name.includes("지역사랑상품권"))!;
  console.log(`[injected] ${row.name} rank=${row.rank} score=${row.score}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
