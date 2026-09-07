/** Verifies rank-1 share and the left-column (#1 over #2) / right-panel (#3+) layout. */
async function main() {
  const { calculateHeatmapSizeRatios, layoutHeatmapLeaves, RANK_1_AREA_RATIO } = await import(
    "@/lib/treemapLayout"
  );

  for (const count of [3, 5, 10, 20]) {
    const items = Array.from({ length: count }, (_, i) => ({
      id: String(i + 1),
      rank: i + 1,
      score: 2200 - i * 45,
    }));
    const { ratios, leftover } = calculateHeatmapSizeRatios(items);
    const shares = items.map((item) => ratios.get(item.id) ?? 0);
    const total = shares.reduce((a, b) => a + b, 0);
    const descending = shares.every((v, i) => i === 0 || v <= shares[i - 1] + 1e-9);

    console.log(
      `${String(count).padStart(2)}개  1위 ${(shares[0] * 100).toFixed(1)}%`.padEnd(20),
      `2위 ${(shares[1] * 100).toFixed(2)}%`.padEnd(14),
      `합계 ${((total + leftover) * 100).toFixed(1)}%`.padEnd(13),
      descending ? "내림차순 O" : "내림차순 X",
    );
  }

  const painted = layoutHeatmapLeaves(
    Array.from({ length: 20 }, (_, i) => ({
      id: String(i + 1),
      rank: i + 1,
      score: 2200 - i * 45,
    })),
    1246,
    640,
  );
  const mapArea = 1246 * 640;
  const r1 = painted.find((box) => box.rank === 1)!;
  const r2 = painted.find((box) => box.rank === 2)!;
  const r3 = painted.find((box) => box.rank === 3)!;
  const leadShare = ((r1.x1 - r1.x0) * (r1.y1 - r1.y0)) / mapArea;

  console.log(`\nRANK_1_AREA_RATIO = ${RANK_1_AREA_RATIO}`);
  console.log(
    `픽셀 1위 ${(leadShare * 100).toFixed(2)}%  타일 ${painted.length}개`,
  );
  console.log(
    `배치 1위 y0=${r1.y0} y1=${r1.y1}  2위 y0=${r2.y0} y1=${r2.y1}  3위 x0=${r3.x0}`,
  );

  if (Math.abs(leadShare - RANK_1_AREA_RATIO) > 0.02) {
    throw new Error(`rank-1 pixel share ${leadShare} is not ~15%`);
  }
  if (!(r2.y0 >= r1.y1 - 1 && r2.x0 <= 2 && r2.x1 <= r1.x1 + 2)) {
    throw new Error("rank 2 must sit directly under rank 1 in the left column");
  }
  if (Math.abs(r2.y1 - 640) > 1) {
    throw new Error(`rank 2 must touch the bottom border (y1=${r2.y1}, expected 640)`);
  }
  if (!(r3.x0 >= r1.x1 - 1)) {
    throw new Error("rank 3+ must start to the right of the rank 1/2 column");
  }

  const fifteen = layoutHeatmapLeaves(
    Array.from({ length: 15 }, (_, i) => ({
      id: `board:demo:tile-${i + 1}`,
      rank: i + 1,
      score: i < 10 ? 999 : 800 - i * 12,
    })),
    1100,
    640,
  );
  const missing = Array.from({ length: 15 }, (_, i) => i + 1).filter(
    (rank) => !fifteen.some((box) => box.rank === rank && box.x1 - box.x0 >= 8 && box.y1 - box.y0 >= 8),
  );
  if (fifteen.length !== 15 || missing.length) {
    throw new Error(`heatmap dropped tiles: count=${fifteen.length} missing=${missing.join(",")}`);
  }
  const paintedArea = fifteen.reduce(
    (sum, box) => sum + Math.max(0, box.x1 - box.x0) * Math.max(0, box.y1 - box.y0),
    0,
  );
  if (paintedArea / (1100 * 640) < 0.96) {
    throw new Error(`heatmap coverage ${paintedArea / (1100 * 640)} is too low — empty cells`);
  }
  console.log("geometry OK: #2 under #1, #3+ on the right, 15/15 tiles, no holes");
}

void main();

export {};
