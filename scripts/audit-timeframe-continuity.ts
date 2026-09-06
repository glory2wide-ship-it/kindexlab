/**
 * Audit 분봉/일봉/주봉/월봉 nested continuity for heatmap entities.
 *
 *   npx tsx --env-file=.env.local scripts/audit-timeframe-continuity.ts
 */
import { getRankings } from "../src/lib/api";
import { buildHeatmapItems } from "../src/lib/boards/heatmap";
import { loadChannelHeatmapPayloads } from "../src/lib/boards/heatmap-server";
import { menuBoardsForChannel } from "../src/lib/boards/registry";
import { POST_CHANNELS } from "../src/lib/posts/channels";
import {
  attachTimeframeMetrics,
  changeForEntity,
  changeForSeries,
  getBaseMinuteCloses,
  getTimeframeSeries,
  scoreForTimeframe,
  seriesOhlc,
} from "../src/lib/timeframes";
import type { RankingEntity, Timeframe } from "../src/lib/types";

const TFS: Timeframe[] = ["3m", "1d", "1w", "1mo"];

async function main() {
  const entities: RankingEntity[] = [];

  for (const meta of POST_CHANNELS) {
    const boards = await loadChannelHeatmapPayloads(meta.id);
    for (const def of menuBoardsForChannel(meta.id).filter((board) => !board.deskKind)) {
      const items = buildHeatmapItems({
        boards,
        board: def.slug,
        gender: "all",
        age: "all",
        region: "all",
      });
      for (const item of items.slice(0, 5)) {
        entities.push(attachTimeframeMetrics(item));
      }
    }
  }

  const market = await getRankings();
  for (const item of market.items.slice(0, 50)) {
    entities.push(attachTimeframeMetrics(item));
  }

  let seriesChecked = 0;
  const within = {
    closeMismatch: 0,
    ohlcInvalid: 0,
    changeMismatch: 0,
    scoreCloseGap: 0,
  };
  let crossCloseMismatch = 0;
  let dailyNotInMinutes = 0;
  const gaps: { name: string; tf: string; score: number; close: number; gap: number }[] = [];

  for (const entity of entities) {
    const closes: number[] = [];
    const minutes = getBaseMinuteCloses(entity);

    for (const tf of TFS) {
      seriesChecked += 1;
      const series = getTimeframeSeries(entity, tf);
      const ohlc = seriesOhlc(series);
      const chEntity = changeForEntity(entity, tf);
      const chSeries = changeForSeries(series);
      const score = scoreForTimeframe(entity, tf);
      closes.push(ohlc.close);

      if (Math.abs(ohlc.close - entity.buzzScore) > 0.011) within.closeMismatch += 1;
      if (
        !(
          ohlc.high + 1e-9 >= ohlc.open &&
          ohlc.high + 1e-9 >= ohlc.close &&
          ohlc.low - 1e-9 <= ohlc.open &&
          ohlc.low - 1e-9 <= ohlc.close
        )
      ) {
        within.ohlcInvalid += 1;
      }
      if (Math.abs(chEntity - chSeries) > 0.05) within.changeMismatch += 1;

      const gap = Math.abs(score - ohlc.close);
      if (gap > 0.05) {
        within.scoreCloseGap += 1;
        if (gaps.length < 8) {
          gaps.push({
            name: entity.name,
            tf,
            score,
            close: ohlc.close,
            gap: Number(gap.toFixed(2)),
          });
        }
      }
    }

    const firstClose = closes[0]!;
    if (closes.some((c) => Math.abs(c - firstClose) > 0.011)) crossCloseMismatch += 1;

    // Spot-check: each displayed daily close should equal a minute close on day boundary.
    const daily = getTimeframeSeries(entity, "1d");
    for (const point of daily) {
      const hit = minutes.some((m) => Math.abs(m - point.v) < 0.011);
      if (!hit) {
        dailyNotInMinutes += 1;
        break;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        entitiesSampled: entities.length,
        seriesChecked,
        withinTf: within,
        scoreCloseGapRate: Number((within.scoreCloseGap / Math.max(seriesChecked, 1)).toFixed(3)),
        crossTfLastCloseMismatch: crossCloseMismatch,
        entitiesWhereDailyCloseMissingFromMinutes: dailyNotInMinutes,
        sampleScoreCloseGaps: gaps,
        note: {
          seriesModel: "Single 1m path → intraday buckets; daily → weekly/monthly",
          sharedClose: "All timeframe last closes equal entity.buzzScore",
          displayScore: "scoreForTimeframe === buzzScore === series close",
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
