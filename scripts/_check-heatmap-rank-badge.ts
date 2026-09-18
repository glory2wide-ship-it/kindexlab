/**
 * Guards for heatmap rank / meta badge paint rules.
 *   npx tsx scripts/_check-heatmap-rank-badge.ts
 */
import assert from "node:assert/strict";
import {
  formatHeatmapRank,
  HEATMAP_META_BADGE_MAX,
  HEATMAP_RANK_BADGE_MAX,
  heatmapShowsMetaBadge,
  heatmapShowsRankBadge,
} from "../src/lib/boards/limits";

assert.equal(HEATMAP_META_BADGE_MAX, 15);
assert.equal(HEATMAP_RANK_BADGE_MAX, 15);
assert.equal(formatHeatmapRank(1), "1");
assert.equal(formatHeatmapRank(20), "20");

// Rank number stays visible through 20위.
assert.equal(heatmapShowsRankBadge(1), true);
assert.equal(heatmapShowsRankBadge(15), true);
assert.equal(heatmapShowsRankBadge(16), true);
assert.equal(heatmapShowsRankBadge(20), true);
assert.equal(heatmapShowsRankBadge(0), false);

// Category·channel chips only for 1–15.
assert.equal(heatmapShowsMetaBadge(1), true);
assert.equal(heatmapShowsMetaBadge(15), true);
assert.equal(heatmapShowsMetaBadge(16), false);
assert.equal(heatmapShowsMetaBadge(20), false);
assert.equal(heatmapShowsMetaBadge(0), false);

console.log("heatmap-rank-badge OK");
