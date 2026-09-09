/**
 * Proves the landing board follows the ingest snapshot for live desks.
 */
import fs from "node:fs";

async function main() {
  const { loadUnifiedMarket } = await import("@/lib/boards/composite-desk");
  const { clearChannelHeatmapMemo } = await import("@/lib/boards/heatmap-server");
  type Payload = Parameters<typeof loadUnifiedMarket>[0];

  clearChannelHeatmapMemo();
  const snapshot = JSON.parse(fs.readFileSync("src/data/ingestion/snapshot.json", "utf8"));
  const base = {
    updatedAt: snapshot.updatedAt,
    status: "open",
    indices: [],
    items: snapshot.items,
  } as unknown as NonNullable<Payload>;

  const bumped = {
    ...base,
    items: base.items.map((item, index) =>
      index < 40
        ? {
            ...item,
            buzzScore: item.buzzScore + 500 - index * 5,
            fluctuationRate: (item.fluctuationRate ?? 0) + (40 - index),
            metrics: undefined,
          }
        : item,
    ),
  };

  const before = await loadUnifiedMarket(base);
  clearChannelHeatmapMemo();
  const after = await loadUnifiedMarket(bumped);

  const names = (market: Awaited<ReturnType<typeof loadUnifiedMarket>>) =>
    market.items.map((item) => item.name);

  console.log(`스냅샷 기준 타일 (${snapshot.updatedAt}):`);
  console.log(`  ${names(before).slice(0, 10).join(" · ")}`);

  const seedLike = ["아이브", "뉴진스", "APT. 로제", "임영웅", "파묘"];
  const hitSeeds = names(before).filter((name) => seedLike.some((seed) => name.includes(seed)));
  console.log(`\n고전 시드명 잔존: ${hitSeeds.length ? hitSeeds.join(", ") : "없음 (라이브 전환)"}`);

  const moved = names(before).join("|") !== names(after).join("|");
  console.log(`스냅샷 점수 변동 시 타일 재배치: ${moved ? "됨" : "안 됨"}`);

  for (const desk of before.desks) {
    const next = after.desks.find((row) => row.channel === desk.channel);
    const previous = desk.top.map((row) => row.name).join(", ");
    const updated = next?.top.map((row) => row.name).join(", ") ?? "";
    console.log(
      `  ${desk.label.padEnd(8)} ${previous === updated ? "고정" : "변경"}  전: ${previous || "(없음)"}`,
    );
  }
}

void main();

export {};
