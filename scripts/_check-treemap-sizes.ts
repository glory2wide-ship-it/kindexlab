/** Verifies the rank-1 share, the descending order, and the total area budget. */
async function main() {
  const { calculateHeatmapSizeRatios, RANK_1_AREA_RATIO } = await import("@/lib/treemapLayout");

  for (const count of [3, 5, 7, 10, 25, 44]) {
    // Scores taper the way a real board does: a clear leader, then a long tail.
    const items = Array.from({ length: count }, (_, i) => ({
      id: String(i + 1),
      rank: i + 1,
      score: 2200 - i * 45,
    }));
    const { ratios, leftover } = calculateHeatmapSizeRatios(items);
    const shares = items.map((item) => ratios.get(item.id) ?? 0);
    const total = shares.reduce((a, b) => a + b, 0);
    const descending = shares.every((v, i) => i === 0 || v <= shares[i - 1] + 1e-9);
    const maxRest = Math.max(...shares.slice(1));

    console.log(
      `${String(count).padStart(2)}개  1위 ${(shares[0] * 100).toFixed(1)}%`.padEnd(20),
      `2위 ${(shares[1] * 100).toFixed(2)}%`.padEnd(14),
      `꼴찌 ${(shares[count - 1] * 100).toFixed(2)}%`.padEnd(15),
      `합계 ${((total + leftover) * 100).toFixed(1)}%`.padEnd(13),
      descending ? "내림차순 O" : "내림차순 X",
      maxRest < shares[0] ? "1위 최대 O" : "1위 최대 X",
      `동일크기 ${new Set(shares.map((v) => v.toFixed(4))).size < count ? "있음" : "없음"}`,
    );
  }

  console.log(`\nRANK_1_AREA_RATIO = ${RANK_1_AREA_RATIO} (${RANK_1_AREA_RATIO * 100}%)`);
}

void main();

export {};
