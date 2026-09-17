/**
 * Guards for heatmap rank badge paint rules.
 *   npx tsx scripts/_check-heatmap-rank-badge.ts
 */
import assert from "node:assert/strict";
import {
  formatHeatmapRank,
  HEATMAP_RANK_BADGE_MAX,
  heatmapShowsRankBadge,
} from "../src/lib/boards/limits";

assert.equal(HEATMAP_RANK_BADGE_MAX, 15);
assert.equal(formatHeatmapRank(1), "1");
assert.equal(formatHeatmapRank(20), "20");
assert.equal(heatmapShowsRankBadge(1), true);
assert.equal(heatmapShowsRankBadge(15), true);
assert.equal(heatmapShowsRankBadge(16), false);
assert.equal(heatmapShowsRankBadge(20), false);
assert.equal(heatmapShowsRankBadge(0), false);

console.log("heatmap-rank-badge OK");
