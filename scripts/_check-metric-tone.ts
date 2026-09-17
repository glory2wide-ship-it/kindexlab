/**
 * Guard: detail hero metric colors follow index direction, not rank-only deltas.
 *   npx tsx scripts/_check-metric-tone.ts
 */
import assert from "node:assert/strict";
import { entityMetricTone } from "../src/lib/entity/metric-tone";
import type { RankingEntity } from "../src/lib/types";

function base(partial: Partial<RankingEntity>): RankingEntity {
  return {
    id: "t",
    slug: "t",
    name: "테스트",
    type: "kpop",
    rank: 5,
    previousRank: 5,
    buzzScore: 100,
    openScore: 100,
    volume: 1,
    fluctuationRate: 0,
    sparkline: [],
    ...partial,
  } as RankingEntity;
}

// Rank worsened but index rose → must be green (not red from rank delta).
assert.equal(
  entityMetricTone(base({ rank: 10, previousRank: 8, fluctuationRate: 1.2, buzzScore: 110, openScore: 100 })),
  "text-up",
);

// Rank improved but index fell → must be red.
assert.equal(
  entityMetricTone(base({ rank: 3, previousRank: 8, fluctuationRate: -2.1, buzzScore: 90, openScore: 100 })),
  "text-down",
);

// Flat ticker rate, open→current up → green.
assert.equal(
  entityMetricTone(base({ fluctuationRate: 0, buzzScore: 120, openScore: 100 })),
  "text-up",
);

console.log("OK metric tone guards");
