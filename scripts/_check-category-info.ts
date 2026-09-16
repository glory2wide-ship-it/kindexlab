/**
 * Smoke guard for Excel-driven ItemDetailCategoryInfo packs.
 *   npx tsx scripts/_check-category-info.ts
 */
import assert from "node:assert/strict";
import {
  buildCategoryInfoPayload,
  resolveCategoryInfoChannel,
} from "../src/lib/entity/category-info";
import type { RankingEntity } from "../src/lib/types";

function entity(partial: Partial<RankingEntity> & Pick<RankingEntity, "name" | "slug" | "type">): RankingEntity {
  return {
    id: partial.id ?? `board:${partial.slug}`,
    slug: partial.slug,
    name: partial.name,
    nameEn: partial.nameEn ?? partial.name,
    type: partial.type,
    rank: partial.rank ?? 1,
    previousRank: partial.previousRank ?? 2,
    score: partial.score ?? 1000,
    openScore: partial.openScore ?? 1000,
    fluctuationRate: partial.fluctuationRate ?? 1,
    volume: partial.volume ?? 100,
    tags: partial.tags ?? [],
    summary: partial.summary ?? `${partial.name} 요약`,
    sourceChannel: partial.sourceChannel,
    heatmapGroup: partial.heatmapGroup,
    ...partial,
  };
}

const cases: RankingEntity[] = [
  entity({
    name: "BTS",
    slug: "kpop-fandom-power--BTS",
    type: "kpop",
    heatmapGroup: "K POP",
    sourceChannel: "entertainment",
  }),
  entity({
    name: "선재 업고 튀어",
    slug: "realtime-tv-ratings--선재-업고-튀어",
    type: "tv_rating",
    heatmapGroup: "TV 시청률",
    tags: ["tvN"],
    sourceChannel: "entertainment",
  }),
  entity({
    name: "삼성전자",
    slug: "kospi-fomo-index--삼성전자",
    type: "stock_market",
    heatmapGroup: "주식",
    sourceChannel: "economy",
  }),
  entity({
    name: "[서울] 래미안대치팰리스",
    slug: "housing-subscription-hotspot--래미안대치팰리스",
    type: "housing",
    heatmapGroup: "지역별 부동산",
    sourceChannel: "economy",
  }),
  entity({
    name: "기본소득당",
    slug: "party-support-chart--기본소득당",
    type: "party_support",
    heatmapGroup: "정당 지지도",
    sourceChannel: "politics",
  }),
];

for (const row of cases) {
  const channel = resolveCategoryInfoChannel(row);
  const payload = buildCategoryInfoPayload(row);
  assert.equal(payload.channel, channel.channel, row.slug);
  assert.ok(payload.links.length >= 3, `${row.slug} needs ≥3 news links`);
  assert.ok(payload.rows.length >= 1, `${row.slug} needs rows or status`);
  assert.ok(payload.channelLabel.length > 0);
  const labels = payload.rows.map((r) => r.label);
  assert.equal(labels.length, new Set(labels).size, `${row.slug} duplicate row labels`);
}

console.log(`category-info OK (${cases.length} channels)`);
