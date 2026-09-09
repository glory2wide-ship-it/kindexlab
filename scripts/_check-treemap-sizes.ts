/** Verifies rank-1 share, full coverage, and square-ish tile aspects. */
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

  const W = 1100;
  const H = 640;
  const painted = layoutHeatmapLeaves(
    Array.from({ length: 15 }, (_, i) => ({
      id: `board:demo:tile-${i + 1}`,
      rank: i + 1,
      score: i < 10 ? 999 : 800 - i * 12,
    })),
    W,
    H,
  );
  const mapArea = W * H;
  const r1 = painted.find((box) => box.rank === 1)!;
  const leadShare = ((r1.x1 - r1.x0) * (r1.y1 - r1.y0)) / mapArea;

  function aspect(box: { x0: number; y0: number; x1: number; y1: number }) {
    const w = Math.max(1, box.x1 - box.x0);
    const h = Math.max(1, box.y1 - box.y0);
    return Math.max(w / h, h / w);
  }

  const aspects = painted.map(aspect).sort((a, b) => a - b);
  const medianAspect = aspects[Math.floor(aspects.length / 2)] ?? 1;
  const worstAspect = aspects[aspects.length - 1] ?? 1;

  console.log(`\nRANK_1_AREA_RATIO = ${RANK_1_AREA_RATIO}`);
  console.log(`픽셀 1위 ${(leadShare * 100).toFixed(2)}%  타일 ${painted.length}개`);
  console.log(`종횡비 중앙값 ${medianAspect.toFixed(2)}  최악 ${worstAspect.toFixed(2)}`);

  if (leadShare < 0.07 || leadShare > 0.14) {
    throw new Error(`rank-1 pixel share ${leadShare} should stay near 10%`);
  }
  const missing = Array.from({ length: 15 }, (_, i) => i + 1).filter(
    (rank) => !painted.some((box) => box.rank === rank && box.x1 - box.x0 >= 8 && box.y1 - box.y0 >= 8),
  );
  if (painted.length !== 15 || missing.length) {
    throw new Error(`heatmap dropped tiles: count=${painted.length} missing=${missing.join(",")}`);
  }
  const paintedArea = painted.reduce(
    (sum, box) => sum + Math.max(0, box.x1 - box.x0) * Math.max(0, box.y1 - box.y0),
    0,
  );
  if (paintedArea / mapArea < 0.96) {
    throw new Error(`heatmap coverage ${paintedArea / mapArea} is too low — empty cells`);
  }
  if (medianAspect > 1.85) {
    throw new Error(`tiles are too elongated (median aspect ${medianAspect})`);
  }
  console.log("geometry OK: squarified tiles, 15/15, no holes");
}

void main();

export {};
