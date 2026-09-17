/**
 * Smoke guard for Excel-driven ItemDetailCategoryInfo packs.
 *   npx tsx scripts/_check-category-info.ts
 */
import assert from "node:assert/strict";
import {
  buildCategoryInfoPayload,
  resolveCategoryInfoChannel,
} from "../src/lib/entity/category-info";
import { isNewsSearchFallbackUrl } from "../src/lib/entity/category-info/news";
import { isNewsPrimaryChannel } from "../src/lib/entity/category-info/channel";
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
  entity({
    name: "유시민",
    slug: "political-pundit-ranking--유시민",
    type: "political_pundit",
    heatmapGroup: "정치평론가",
    sourceChannel: "politics",
  }),
];

for (const row of cases) {
  const channel = resolveCategoryInfoChannel(row);
  const payload = buildCategoryInfoPayload(row);
  assert.equal(payload.channel, channel.channel, row.slug);
  // Build may be thin before enrich; never invent Naver/Google search placeholders.
  const searchFallbacks = payload.links.filter((link) => isNewsSearchFallbackUrl(link.href));
  assert.equal(
    searchFallbacks.length,
    0,
    `${row.slug} must not pad with search fallback (got ${searchFallbacks.length})`,
  );
  assert.ok(
    !payload.links.some((link) => /추가 수집 중/.test(link.title)),
    `${row.slug} must not show “추가 수집 중” search placeholders`,
  );
  assert.ok(payload.rows.length >= 1, `${row.slug} needs rows or status`);
  assert.ok(payload.channelLabel.length > 0);
  const labels = payload.rows.map((r) => r.label);
  assert.equal(labels.length, new Set(labels).size, `${row.slug} duplicate row labels`);
  if (row.type === "political_pundit") {
    assert.equal(isNewsPrimaryChannel(payload.channel), false, "pundit must not be news-primary");
    assert.ok(
      payload.rows.some((r) => /방송 출연|유튜브|SNS/.test(r.label)),
      "pundit rows should include 방송/유튜브/SNS",
    );
  }
}

console.log(`category-info OK (${cases.length} channels)`);
