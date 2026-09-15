/**
 * Rebuild + validate landing unified market (카테고리별 1~4위).
 *
 *   node --require ./scripts/stub-server-only.cjs --import tsx scripts/rebuild-landing-tops.ts
 *   npm run landing:tops
 */
import { assertLandingMarketShape, loadUnifiedMarket } from "../src/lib/boards/composite-desk";
import { DESK_TOP_N, LANDING_PER_CHANNEL_TOP } from "../src/lib/boards/landing-constants";
import { clearChannelHeatmapMemo } from "../src/lib/boards/heatmap-server";
import { POST_CHANNELS } from "../src/lib/posts/channels";

async function main() {
  if (DESK_TOP_N !== LANDING_PER_CHANNEL_TOP) {
    throw new Error(
      `DESK_TOP_N (${DESK_TOP_N}) must equal LANDING_PER_CHANNEL_TOP (${LANDING_PER_CHANNEL_TOP})`,
    );
  }

  clearChannelHeatmapMemo();
  const market = await loadUnifiedMarket();

  if (!assertLandingMarketShape(market)) {
    console.error(
      JSON.stringify(
        {
          items: market.items.length,
          ranks: market.items.map((item) => item.rank),
          desks: market.desks.map((desk) => ({
            channel: desk.channel,
            top: desk.top.map((item) => item.name),
          })),
        },
        null,
        2,
      ),
    );
    throw new Error("Landing market shape invalid — category 1~4 not fully filled");
  }

  for (const meta of POST_CHANNELS) {
    const desk = market.desks.find((row) => row.channel === meta.id);
    const tiles = market.items.filter((item) => item.sourceChannel === meta.id);
    console.log(
      `${meta.id}\tdesk=${desk?.top.length}\theatmap=${tiles.length}\t` +
        (desk?.top.map((item) => item.name).join(" | ") ?? ""),
    );
  }

  console.log(
    `OK landing tops: ${market.items.length} tiles, desks ${DESK_TOP_N}/channel, ranks 1..${market.items.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
