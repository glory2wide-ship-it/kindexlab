/**
 * Compare landing loadUnifiedMarket() heatmap tiles vs each category
 * 종합 LIVE desk top-4 under timeframe=3m, gender=all, age=all.
 *
 *   npx tsx scripts/_audit-landing-vs-category-tops.ts
 */
import { buildHeatmapItems, type HeatmapBoardPayload } from "@/lib/boards/heatmap";
import {
  clearChannelHeatmapMemo,
  loadChannelHeatmapPayloads,
  loadHeatmapLivePayload,
  toTileEntity,
} from "@/lib/boards/heatmap-server";
import {
  LANDING_HEATMAP_TIMEFRAME,
  LANDING_PER_CHANNEL_TOP,
  loadUnifiedMarket,
} from "@/lib/boards/composite-desk";
import { countLivePreferRows, preferLiveChannelComposite } from "@/lib/boards/limits";
import { itemsForChannel, POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import { attachTimeframeMetrics, rankItemsForTimeframe } from "@/lib/timeframes";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

function nameKey(name: string): string {
  return (name ?? "").replace(/\s+/g, "").toLowerCase();
}

function names(items: RankingEntity[]): string[] {
  return items.map((item) => item.name);
}

function setEq(a: string[], b: string[]): boolean {
  const left = new Set(a.map(nameKey));
  const right = new Set(b.map(nameKey));
  if (left.size !== right.size) return false;
  for (const key of left) if (!right.has(key)) return false;
  return true;
}

function orderedEq(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((name, i) => nameKey(name) === nameKey(b[i] ?? ""));
}

/** Same pool a category 종합 desk builds (boards + live + preferLive all/all). */
async function categoryCompositePool(
  channel: PostChannel,
  market: RankingsPayload | undefined,
): Promise<{ pool: RankingEntity[]; preferLive: boolean; liveCount: number }> {
  let boards: HeatmapBoardPayload[] = [];
  try {
    boards = await loadChannelHeatmapPayloads(channel);
  } catch {
    boards = [];
  }

  // Match ChannelMarketDesk / channel-page-data: channelLiveMarket uses toTileEntity.
  const liveItems = market?.items?.length
    ? itemsForChannel(market.items, channel).map(toTileEntity)
    : [];
  const liveCount = countLivePreferRows(liveItems, channel);
  const preferLive = preferLiveChannelComposite(channel, undefined, liveCount, {
    gender: "all",
    age: "all",
  });

  const pool = buildHeatmapItems({
    boards,
    liveItems,
    gender: "all",
    age: "all",
    preferLive,
  });
  return { pool, preferLive, liveCount };
}

async function main() {
  clearChannelHeatmapMemo();
  const market = loadHeatmapLivePayload();
  if (!market?.items?.length) {
    console.error("No live heatmap payload — abort");
    process.exit(1);
  }

  console.log("=== Landing vs category 종합 top-4 (3m / all / all) ===");
  console.log(`snapshot updatedAt=${market.updatedAt}`);
  console.log(`timeframe=${LANDING_HEATMAP_TIMEFRAME} · perChannel=${LANDING_PER_CHANNEL_TOP}\n`);

  const categoryTops = new Map<PostChannel, RankingEntity[]>();
  const categoryMeta = new Map<
    PostChannel,
    { preferLive: boolean; liveCount: number; poolSize: number }
  >();

  for (const meta of POST_CHANNELS) {
    const { pool, preferLive, liveCount } = await categoryCompositePool(meta.id, market);
    const ranked = rankItemsForTimeframe(pool, LANDING_HEATMAP_TIMEFRAME).slice(
      0,
      LANDING_PER_CHANNEL_TOP,
    );
    categoryTops.set(meta.id, ranked);
    categoryMeta.set(meta.id, { preferLive, liveCount, poolSize: pool.length });
  }

  const unified = await loadUnifiedMarket(market);
  const landingByChannel = new Map<PostChannel, RankingEntity[]>();
  for (const meta of POST_CHANNELS) landingByChannel.set(meta.id, []);
  for (const item of unified.items) {
    const ch = item.sourceChannel as PostChannel | undefined;
    if (!ch || !landingByChannel.has(ch)) {
      console.warn(`! untagged or unknown sourceChannel: ${item.name} [${ch ?? "missing"}]`);
      continue;
    }
    landingByChannel.get(ch)!.push(item);
  }

  let allSetsMatch = true;
  let allOrderedMatch = true;

  for (const meta of POST_CHANNELS) {
    const cat = categoryTops.get(meta.id) ?? [];
    const land = landingByChannel.get(meta.id) ?? [];
    const catNames = names(cat);
    const landNames = names(land);
    const sets = setEq(catNames, landNames);
    const ordered = orderedEq(catNames, landNames);
    const info = categoryMeta.get(meta.id)!;
    if (!sets) allSetsMatch = false;
    if (!ordered) allOrderedMatch = false;

    console.log(`## ${meta.id}`);
    console.log(
      `  preferLive=${info.preferLive} livePreferRows=${info.liveCount} poolSize=${info.poolSize}`,
    );
    console.log(`  category top-4 (ordered): ${catNames.join(" | ") || "(empty)"}`);
    console.log(
      `  landing  by-ch (order of appearance): ${landNames.join(" | ") || "(empty)"} (n=${land.length})`,
    );
    console.log(`  SET match: ${sets ? "YES" : "NO"} · ordered top-4 match: ${ordered ? "YES" : "NO"}`);
    if (!sets) {
      const catSet = new Set(catNames.map(nameKey));
      const landSet = new Set(landNames.map(nameKey));
      const onlyCat = catNames.filter((n) => !landSet.has(nameKey(n)));
      const onlyLand = landNames.filter((n) => !catSet.has(nameKey(n)));
      if (onlyCat.length) console.log(`  only in category: ${onlyCat.join(" | ")}`);
      if (onlyLand.length) console.log(`  only on landing:  ${onlyLand.join(" | ")}`);
    }
    console.log("");
  }

  // Also simulate landing client re-rank of the unified set (MarketWorkspace path).
  const clientRanked = rankItemsForTimeframe(unified.items, LANDING_HEATMAP_TIMEFRAME);
  const clientByChannel = new Map<PostChannel, string[]>();
  for (const meta of POST_CHANNELS) clientByChannel.set(meta.id, []);
  for (const item of clientRanked) {
    const ch = item.sourceChannel as PostChannel | undefined;
    if (ch && clientByChannel.has(ch)) clientByChannel.get(ch)!.push(item.name);
  }

  console.log("## After client re-rank of unified items (sets should be unchanged)");
  let clientSetsOk = true;
  for (const meta of POST_CHANNELS) {
    const catNames = names(categoryTops.get(meta.id) ?? []);
    const clientNames = clientByChannel.get(meta.id) ?? [];
    const ok = setEq(catNames, clientNames);
    if (!ok) clientSetsOk = false;
    console.log(`  ${meta.id}: SET match after re-rank: ${ok ? "YES" : "NO"} (n=${clientNames.length})`);
  }

  console.log("\n=== Summary ===");
  console.log(`landing item count: ${unified.items.length}`);
  console.log(`all channel SETs match: ${allSetsMatch ? "YES" : "NO"}`);
  console.log(`all channel ordered top-4 match: ${allOrderedMatch ? "YES" : "NO"}`);
  console.log(`client re-rank preserves SETs: ${clientSetsOk ? "YES" : "NO"}`);
  console.log(
    `landing interleaved names: ${unified.items.map((i) => `${i.name}[${i.sourceChannel}]`).join(", ")}`,
  );

  process.exit(allSetsMatch ? 0 : 2);
}

void main();
