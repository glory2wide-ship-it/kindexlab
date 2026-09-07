import { heatmapChannelHeatScale } from "../src/lib/heatmap-channel-scale";
import { heatForTimeframe } from "../src/lib/timeframes";
import type { RankingEntity } from "../src/lib/types";

function stub(
  name: string,
  opts: { channel: RankingEntity["sourceChannel"]; slug: string; volume: number; change: number },
): RankingEntity {
  return {
    id: name,
    slug: opts.slug,
    name,
    nameEn: name,
    type: "influencer",
    rank: 1,
    previousRank: 1,
    buzzScore: 900,
    openScore: 900,
    fluctuationRate: opts.change,
    volume: opts.volume,
    sparkline: [100, 110],
    history: [],
    tags: [],
    summary: "",
    sourceChannel: opts.channel,
  };
}

const at = new Date("2026-09-07T12:00:00.000Z"); // Monday 21:00 KST
const travelScale = heatmapChannelHeatScale(
  { sourceChannel: "travel", slug: "food-restaurant-ranking--x" },
  at,
);
const entScale = heatmapChannelHeatScale({ sourceChannel: "entertainment", slug: "kpop--x" }, at);

const food = stub("광장시장", {
  channel: "travel",
  slug: "food-restaurant-ranking--gwangjang",
  volume: 99.9 * 32,
  change: 7.4,
});
const idol = stub("아이브", {
  channel: "entertainment",
  slug: "kpop-group-ranking--ive",
  volume: 99.9 * 80,
  change: 7.4,
});
const pol = stub("이재명", {
  channel: "politics",
  slug: "politician-support-chart--lee",
  volume: 99.9 * 80,
  change: 7.4,
});

const ranked = [food, idol, pol]
  .map((item) => ({ name: item.name, heat: heatForTimeframe(item, "3m"), channel: item.sourceChannel }))
  .sort((a, b) => b.heat - a.heat);

console.log(JSON.stringify({ travelScale: Number(travelScale.toFixed(3)), entScale, ranked }, null, 2));
if (ranked[0]?.channel === "travel") {
  console.error("travel still ranks first against matched change/volume peers");
  process.exit(1);
}
if (travelScale >= 0.35) {
  console.error("weekday evening travel scale should stay well below 0.35", travelScale);
  process.exit(1);
}
