/**
 * Smoke checks for live-first heatmap gate + soft subsidy seed padding.
 * Uses rates-finance-products (not retired issue-keyword boards).
 */
import assert from "node:assert/strict";
import { buildHeatmapItems, type HeatmapBoardPayload } from "@/lib/boards/heatmap";
import { countLivePreferRows, preferLiveChannelComposite } from "@/lib/boards/limits";
import { ensureSubsidyRanking } from "@/lib/politics/labeled-rank";
import type { RankingEntity } from "@/lib/types";

function fakeLive(
  name: string,
  tags: string[],
  channel: "economy" | "culture" | "travel",
  type: RankingEntity["type"] = "finance_product",
  slug = `rates-finance-products--${name}`,
): RankingEntity {
  return {
    id: `id-${name}`,
    slug,
    name,
    nameEn: "",
    type,
    rank: 1,
    previousRank: 1,
    buzzScore: 80,
    openScore: 70,
    fluctuationRate: 1,
    volume: 1000,
    sparkline: [],
    history: [],
    tags,
    summary: "",
    sourceChannel: channel,
  };
}

const boardTape = fakeLive("씨드종목", ["board-tape", "rates-finance-products"], "economy");
const liveChart = fakeLive("네이버뉴스이슈", ["live-chart", "rates-finance-products"], "economy");

assert.equal(countLivePreferRows([boardTape, liveChart], "economy"), 1);
assert.equal(preferLiveChannelComposite("economy", undefined, 1), false);
assert.equal(preferLiveChannelComposite("economy", undefined, 3), true);
assert.equal(preferLiveChannelComposite("economy", "kospi-fomo-index", 10), true);
assert.equal(preferLiveChannelComposite("culture", undefined, 5), true);
assert.equal(preferLiveChannelComposite("travel", undefined, 5), true);
assert.equal(
  preferLiveChannelComposite("entertainment", undefined, 20, { gender: "male" }),
  false,
);
assert.equal(
  preferLiveChannelComposite("entertainment", undefined, 20, { age: "20s" }),
  false,
);
assert.equal(
  preferLiveChannelComposite("entertainment", undefined, 20, { gender: "all", age: "all" }),
  true,
);

const boards: HeatmapBoardPayload[] = [
  {
    slug: "rates-finance-products",
    title: "금리·금융상품",
    shortTitle: "금리·금융",
    channel: "economy",
    ranking: [{ rank: 1, name: "보드시드", score: 90, changeRate: 1, note: "" }],
    indexValue: 90,
    indexChangeRate: 1,
    unitLabel: "상품",
  },
];

const liveItems = [
  liveChart,
  fakeLive("유튜브이슈", ["live-chart", "rates-finance-products"], "economy"),
  fakeLive("추가라이브", ["live-chart", "rates-finance-products"], "economy"),
  boardTape,
];

const composite = buildHeatmapItems({
  boards,
  liveItems,
  gender: "all",
  age: "all",
  preferLive: true,
});
assert.ok(composite.length >= 3);
assert.equal(composite[0]?.name, "네이버뉴스이슈");
assert.ok(!composite.slice(0, 3).some((item) => item.tags?.includes("board-tape")));

// Retired issue-keyword entities must not paint on heatmaps.
const retired = buildHeatmapItems({
  boards: [
    {
      slug: "economy-issue-keywords",
      title: "이슈 키워드",
      shortTitle: "이슈 키워드",
      channel: "economy",
      ranking: [{ rank: 1, name: "금투세", score: 90, changeRate: 1, note: "" }],
      indexValue: 90,
      indexChangeRate: 1,
      unitLabel: "키워드",
    },
  ],
  liveItems: [
    fakeLive(
      "금투세",
      ["live-chart", "economy-issue-keywords"],
      "economy",
      "economy_issue",
      "economy-issue-keywords--금투세",
    ),
  ],
  gender: "all",
  age: "all",
  preferLive: true,
});
assert.equal(retired.length, 0);

const subsidy = ensureSubsidyRanking([
  { rank: 1, name: "[국세청] 근로장려금 특례", score: 95, changeRate: 2, note: "" },
  { rank: 2, name: "[보건복지부] 부모급여 확대", score: 90, changeRate: 1, note: "" },
  { rank: 3, name: "[고용노동부] 국민취업지원제도 개편", score: 85, changeRate: 0.5, note: "" },
]);
assert.ok(subsidy.some((row) => row.name.includes("근로장려금")));
assert.ok(subsidy.length >= 3);
assert.ok(subsidy.length <= 30);

console.log("live-first smoke ok", {
  compositeTop: composite.slice(0, 3).map((item) => item.name),
  subsidyCount: subsidy.length,
  retiredCount: retired.length,
});
