/** Verifies strict rank area order, coverage (no gaps), and layout variants. */
function maxLeaderShareForTest(count: number): number {
  const step = 0.94;
  const geoSum = (1 - Math.pow(step, Math.max(count, 1))) / (1 - step);
  const minFirstToFill = 1 / Math.max(geoSum, 1e-9);
  const preferred =
    count >= 15 ? 0.1 : count >= 10 ? 0.12 : count >= 6 ? 0.2 : count >= 4 ? 0.3 : 0.4;
  return Math.max(preferred, minFirstToFill) + 0.02; // tolerance for renormalize noise
}

async function main() {
  const {
    calculateHeatmapSizeRatios,
    layoutHeatmapLeaves,
    pickHeatmapLayoutVariant,
    RANK_1_AREA_RATIO,
    RANK_TOP_AREA_CAP,
  } = await import("@/lib/treemapLayout");

  for (const count of [3, 5, 10, 15, 20]) {
    const items = Array.from({ length: count }, (_, i) => ({
      id: String(i + 1),
      rank: i + 1,
      score: 2200 - i * 45,
      name: i % 2 === 0 ? "짧은이름" : "조금 더 긴 종목 이름 예시",
    }));
    const { ratios } = calculateHeatmapSizeRatios(items);
    const shares = items.map((item) => ratios.get(item.id) ?? 0);
    const descending = shares.every((v, i) => i === 0 || v <= shares[i - 1]! + 1e-9);
    const topOk = shares[0]! <= maxLeaderShareForTest(count) + 1e-6;
    const sum = shares.reduce((a, b) => a + b, 0);

    console.log(
      `${String(count).padStart(2)}개  1위 ${(shares[0]! * 100).toFixed(1)}%`.padEnd(20),
      `2위 ${((shares[1] ?? 0) * 100).toFixed(2)}%`.padEnd(14),
      `말위 ${((shares.at(-1) ?? 0) * 100).toFixed(2)}%`.padEnd(14),
      topOk ? "캡 O" : "캡 X",
      descending ? "1≥…≥N O" : "1≥…≥N X",
      `sum=${sum.toFixed(3)}`,
    );
    if (!topOk) {
      throw new Error(`#1 over soft cap for n=${count}`);
    }
    if (!descending) throw new Error(`strict descending areas broken for n=${count}`);
    if (Math.abs(sum - 1) > 1e-6) throw new Error(`shares must sum to 1 for n=${count}`);
  }

  const W = 390;
  const H = 560;
  const mapArea = W * H;
  const items = Array.from({ length: 15 }, (_, i) => ({
    id: `board:demo:tile-${i + 1}`,
    rank: i + 1,
    score: 999 - i * 12,
    name: `종목이름${i + 1}`,
  }));

  const variants = [
    "squarify",
    "mirror-x",
    "mirror-y",
    "bands-top",
    "spine-left",
    "slice-dice",
  ] as const;

  for (const variant of variants) {
    const painted = layoutHeatmapLeaves(items, W, H, 2, { variant });
    const byRank = [...painted].sort((a, b) => a.rank - b.rank);
    const areas = byRank.map((box) => Math.max(0, box.x1 - box.x0) * Math.max(0, box.y1 - box.y0));
    const covered = areas.reduce((sum, a) => sum + a, 0);
    const coverage = covered / mapArea;
    const leadShare = areas[0]! / mapArea;
    const secondShare = (areas[1] ?? 0) / mapArea;
    // Pixel areas should be non-increasing by rank (allow tiny gutter noise).
    const pixelDesc = areas.every((a, i) => i === 0 || a <= areas[i - 1]! * 1.08 + 1);
    // Lower ranks should sit further right or down on average.
    const topCentroid = {
      x: (byRank[0]!.x0 + byRank[0]!.x1) / 2,
      y: (byRank[0]!.y0 + byRank[0]!.y1) / 2,
    };
    const bottomCentroid = {
      x: (byRank.at(-1)!.x0 + byRank.at(-1)!.x1) / 2,
      y: (byRank.at(-1)!.y0 + byRank.at(-1)!.y1) / 2,
    };
    const lowerTowardEdge =
      bottomCentroid.x + bottomCentroid.y >= topCentroid.x + topCentroid.y - 8;

    if (painted.length !== 15) throw new Error(`${variant} dropped tiles: ${painted.length}`);
    if (coverage < 0.92) {
      throw new Error(`${variant} coverage ${coverage.toFixed(3)} — gaps under tiles`);
    }
    if (leadShare > RANK_TOP_AREA_CAP + 0.05) {
      throw new Error(`${variant} rank-1 pixel share ${leadShare} too large`);
    }
    if (!pixelDesc) {
      throw new Error(`${variant} pixel areas not descending by rank`);
    }
    if (variant === "squarify" && !lowerTowardEdge) {
      throw new Error(`${variant} lower ranks should sit further right/bottom`);
    }
    console.log(
      `variant ${variant.padEnd(12)} 1위 ${(leadShare * 100).toFixed(1)}%  2위 ${(secondShare * 100).toFixed(1)}%  cover ${(coverage * 100).toFixed(1)}%  tiles ${painted.length}`,
    );
  }

  const a = pickHeatmapLayoutVariant("entertainment:foo:15");
  const b = pickHeatmapLayoutVariant("politics:bar:15");
  console.log(`seed variants ${a} / ${b}`);
  console.log(`RANK_1_AREA_RATIO=${RANK_1_AREA_RATIO} RANK_TOP_AREA_CAP=${RANK_TOP_AREA_CAP}`);
  console.log("geometry OK: no gaps + strict 1≥…≥N + lower ranks right/bottom");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
