/**
 * Proves the landing board follows the ingest snapshot.
 *
 * Builds the unified market from the current snapshot, then from a snapshot
 * perturbed the way a fresh ingest tick would perturb it, and reports whether
 * the tiles and desk cards actually move.
 */
import fs from "node:fs";

async function main() {
  const { loadUnifiedMarket } = await import("@/lib/boards/composite-desk");
  type Payload = Parameters<typeof loadUnifiedMarket>[0];

  const snapshot = JSON.parse(fs.readFileSync("src/data/ingestion/snapshot.json", "utf8"));
  const base = {
    updatedAt: snapshot.updatedAt,
    status: "open",
    indices: [],
    items: snapshot.items,
  } as unknown as NonNullable<Payload>;

  // A tick reshuffles scores by a few points, not wholesale; nudging the top of
  // each type is the smallest change a real refresh would produce.
  const bumped = {
    ...base,
    items: base.items.map((item, index) =>
      index % 7 === 0 ? { ...item, buzzScore: item.buzzScore + 120 } : item,
    ),
  };

  const before = await loadUnifiedMarket(base);
  const after = await loadUnifiedMarket(bumped);
  const boardsOnly = await loadUnifiedMarket(undefined);

  const names = (m: Awaited<ReturnType<typeof loadUnifiedMarket>>) =>
    m.items.map((item) => item.name);

  console.log(`스냅샷 기준 타일 25개 (${snapshot.updatedAt}):`);
  console.log(`  ${names(before).slice(0, 8).join(" · ")} ...`);
  console.log(`\n보드(seed) 기준 타일:`);
  console.log(`  ${names(boardsOnly).slice(0, 8).join(" · ")} ...`);

  const sameAsBoards = names(before).join("|") === names(boardsOnly).join("|");
  console.log(`\n스냅샷 결과가 보드 seed 결과와 동일한가: ${sameAsBoards ? "예 (전환 실패)" : "아니오 (전환 성공)"}`);

  const moved = names(before).join("|") !== names(after).join("|");
  console.log(`스냅샷 변동 시 타일 재배치: ${moved ? "됨" : "안 됨"}`);

  for (const desk of before.desks) {
    const next = after.desks.find((d) => d.channel === desk.channel);
    const b = desk.top.map((t) => t.name).join(", ");
    const a = next?.top.map((t) => t.name).join(", ") ?? "";
    console.log(
      `  ${desk.label.padEnd(8)} ${b === a ? "고정" : "변경"}  전: ${b || "(없음)"}`,
    );
  }
}

void main();

export {};
