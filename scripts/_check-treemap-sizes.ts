/** Verifies Finviz-style squarified shares, coverage, and square-ish tiles. */
async function main() {
  const { calculateHeatmapSizeRatios, layoutHeatmapLeaves, RANK_1_AREA_RATIO } = await import(
    "@/lib/treemapLayout"
  );

  for (const count of [3, 5, 10, 20]) {
    const items = Array.from({ length: count }, (_, i) => ({
      id: String(i + 1),
      rank: i + 1,
      score: 2200 - i * 45,
      name: i % 2 === 0 ? "짧은이름" : "조금 더 긴 종목 이름 예시",
    }));
    const { ratios, leftover } = calculateHeatmapSizeRatios(items);
    const shares = items.map((item) => ratios.get(item.id) ?? 0);
    const total = shares.reduce((a, b) => a + b, 0);
    const descending = shares.every((v, i) => i === 0 || v < shares[i - 1]! - 1e-12);

    console.log(
      `${String(count).padStart(2)}개  1위 ${(shares[0]! * 100).toFixed(1)}%`.padEnd(20),
      `2위 ${(shares[1]! * 100).toFixed(2)}%`.padEnd(14),
      `합계 ${((total + leftover) * 100).toFixed(1)}%`.padEnd(13),
      descending ? "엄격내림 O" : "엄격내림 X",
    );
    if (!descending) throw new Error(`rank areas not strictly descending for n=${count}`);
  }

  const W = 1100;
  const H = 640;
  const painted = layoutHeatmapLeaves(
    Array.from({ length: 15 }, (_, i) => ({
      id: `board:demo:tile-${i + 1}`,
      rank: i + 1,
      score: i < 10 ? 999 : 800 - i * 12,
      name: `종목${i + 1}`,
    })),
    W,
    H,
  );
  const mapArea = W * H;
  const byRank = [...painted].sort((a, b) => a.rank - b.rank);
  const areas = byRank.map((box) => Math.max(0, box.x1 - box.x0) * Math.max(0, box.y1 - box.y0));
  const pixelDescending = areas.every((area, i) => i === 0 || area <= areas[i - 1]! + mapArea * 0.002);
  const r1 = byRank[0]!;
  const leadShare = areas[0]! / mapArea;

  function aspect(box: { x0: number; y0: number; x1: number; y1: number }) {
    const w = Math.max(1, box.x1 - box.x0);
    const h = Math.max(1, box.y1 - box.y0);
    return Math.max(w / h, h / w);
  }

  const aspects = painted.map(aspect).sort((a, b) => a - b);
  const medianAspect = aspects[Math.floor(aspects.length / 2)] ?? 1;
  const worstAspect = aspects[aspects.length - 1] ?? 1;

  console.log(`\nRANK_1_AREA_RATIO (soft typical) = ${RANK_1_AREA_RATIO}`);
  console.log(`픽셀 1위 ${(leadShare * 100).toFixed(2)}%  타일 ${painted.length}개`);
  console.log(`종횡비 중앙값 ${medianAspect.toFixed(2)}  최악 ${worstAspect.toFixed(2)}`);
  console.log(`1위 종횡비 ${aspect(r1).toFixed(2)}`);
  console.log(pixelDescending ? "픽셀면적 내림차순 O" : "픽셀면적 내림차순 X");

  if (leadShare < 0.08 || leadShare > 0.32) {
    throw new Error(`rank-1 pixel share ${leadShare} outside Finviz-like band`);
  }
  if (aspect(r1) > 2.2) {
    throw new Error(`rank-1 aspect ${aspect(r1)} is too elongated for a squarified map`);
  }
  if (!pixelDescending) {
    throw new Error("pixel areas must be non-increasing with rank");
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
  console.log("geometry OK: Finviz-style squarified tiles, 15/15, no holes");
}

void main();

export {};
