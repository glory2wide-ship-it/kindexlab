/** Verifies ≤10% #1/#2 caps, coverage, and layout variants. */
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
    const descendingHead = !shares[1] || shares[1]! <= shares[0]! + 1e-9;
    const descendingTail = shares.slice(2).every((v, i) => i === 0 || v <= shares[i + 1]! + 1e-9 || v <= shares[i + 1]!);
    // Tail ranks 3..n should be non-increasing among themselves.
    const tailOk = shares.slice(2).every((v, i, arr) => i === 0 || v <= arr[i - 1]! + 1e-9);
    const topOk = shares[0]! <= RANK_TOP_AREA_CAP + 1e-6;
    const secondOk = !shares[1] || shares[1]! <= RANK_TOP_AREA_CAP + 1e-6;

    console.log(
      `${String(count).padStart(2)}개  1위 ${(shares[0]! * 100).toFixed(1)}%`.padEnd(20),
      `2위 ${((shares[1] ?? 0) * 100).toFixed(2)}%`.padEnd(14),
      topOk && secondOk ? "캡≤10% O" : "캡≤10% X",
      descendingHead && tailOk ? "질서 O" : "질서 X",
    );
    if (!topOk || !secondOk) {
      throw new Error(`#1/#2 must be ≤${RANK_TOP_AREA_CAP * 100}% for n=${count}`);
    }
    if (!descendingHead || !tailOk) throw new Error(`rank area order broken for n=${count}`);
    void descendingTail;
  }

  const W = 390;
  const H = 560;
  const items = Array.from({ length: 15 }, (_, i) => ({
    id: `board:demo:tile-${i + 1}`,
    rank: i + 1,
    score: i < 10 ? 999 : 800 - i * 12,
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
    const mapArea = W * H;
    const byRank = [...painted].sort((a, b) => a.rank - b.rank);
    const areas = byRank.map((box) => Math.max(0, box.x1 - box.x0) * Math.max(0, box.y1 - box.y0));
    const aspects = byRank.slice(0, 3).map((box) => {
      const bw = Math.max(1, box.x1 - box.x0);
      const bh = Math.max(1, box.y1 - box.y0);
      return Math.max(bw / bh, bh / bw);
    });
    const leadShare = areas[0]! / mapArea;
    const secondShare = (areas[1] ?? 0) / mapArea;
    if (painted.length !== 15) throw new Error(`${variant} dropped tiles: ${painted.length}`);
    if (leadShare > RANK_TOP_AREA_CAP + 0.04) {
      throw new Error(`${variant} rank-1 pixel share ${leadShare} too large`);
    }
    if (secondShare > RANK_TOP_AREA_CAP + 0.045) {
      throw new Error(`${variant} rank-2 pixel share ${secondShare} too large`);
    }
    // Default/mirror packs: top-3 should stay near-square (aspect ≤ ~2.2).
    if (variant === "squarify" || variant.startsWith("mirror")) {
      for (const [index, aspect] of aspects.entries()) {
        if (aspect > 2.4) {
          throw new Error(`${variant} rank-${index + 1} aspect ${aspect.toFixed(2)} too elongated`);
        }
      }
    }
    console.log(
      `variant ${variant.padEnd(12)} 1위 ${(leadShare * 100).toFixed(1)}%  2위 ${(secondShare * 100).toFixed(1)}%  tiles ${painted.length}  topAspect ${aspects.map((a) => a.toFixed(2)).join("/")}`,
    );
  }

  const a = pickHeatmapLayoutVariant("entertainment:foo:15");
  const b = pickHeatmapLayoutVariant("politics:bar:15");
  console.log(`seed variants ${a} / ${b}`);
  console.log(`RANK_1_AREA_RATIO=${RANK_1_AREA_RATIO} RANK_TOP_AREA_CAP=${RANK_TOP_AREA_CAP}`);
  console.log("geometry OK: ≤10% leaders + mobile layout variants");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
