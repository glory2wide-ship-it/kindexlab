/**
 * Smoke checks for live-first heatmap gate + soft subsidy seed padding.
 */
import assert from "node:assert/strict";
import { buildHeatmapItems, type HeatmapBoardPayload } from "@/lib/boards/heatmap";
import { countLivePreferRows, preferLiveChannelComposite } from "@/lib/boards/limits";
import { ensureSubsidyRanking } from "@/lib/politics/labeled-rank";
import type { RankingEntity } from "@/lib/types";

function fakeLive(name: string, tags: string[], channel: "economy" | "culture" | "travel"): RankingEntity {
  return {
    id: `id-${name}`,
    slug: `slug-${name}`,
    name,
    nameEn: "",
    type: "economy_issue",
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

const boardTape = fakeLive("씨드종목", ["board-tape", "economy-issue-keywords"], "economy");
const liveChart = fakeLive("네이버뉴스이슈", ["live-chart", "economy-issue-keywords"], "economy");

assert.equal(countLivePreferRows([boardTape, liveChart], "economy"), 1);
assert.equal(preferLiveChannelComposite("economy", undefined, 1), false);
assert.equal(preferLiveChannelComposite("economy", undefined, 3), true);
assert.equal(preferLiveChannelComposite("economy", "kospi-fomo-index", 10), false);
assert.equal(preferLiveChannelComposite("culture", undefined, 5), true);
assert.equal(preferLiveChannelComposite("travel", undefined, 5), true);

const boards: HeatmapBoardPayload[] = [
  {
    slug: "economy-issue-keywords",
    title: "경제 이슈",
    shortTitle: "경제 이슈",
    channel: "economy",
    ranking: [{ rank: 1, name: "보드시드", score: 90, changeRate: 1, note: "" }],
    indexValue: 90,
    indexChangeRate: 1,
    unitLabel: "이슈",
  },
];

const liveItems = [
  liveChart,
  fakeLive("유튜브이슈", ["live-chart", "economy-issue-keywords"], "economy"),
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

const subsidy = ensureSubsidyRanking([
  { rank: 1, name: "[국세청] 근로장려금 특례", score: 95, changeRate: 2, note: "" },
  { rank: 2, name: "[보건복지부] 부모급여 확대", score: 90, changeRate: 1, note: "" },
  { rank: 3, name: "[고용노동부] 국민취업지원제도 개편", score: 85, changeRate: 0.5, note: "" },
]);
assert.ok(subsidy.some((row) => row.name.includes("근로장려금")));
assert.ok(subsidy.length >= 3);
// Live labeled names should not be wiped when enough rows exist.
assert.ok(subsidy.length <= 30);

console.log("live-first smoke ok", {
  compositeTop: composite.slice(0, 3).map((item) => item.name),
  subsidyCount: subsidy.length,
});
