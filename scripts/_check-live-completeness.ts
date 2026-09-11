/**
 * Heatmap LIVE completeness report by channel / board.
 * live% = live-prefer rows in the painted screen head (top 20) after overlay.
 *
 *   npm run live:completeness
 */
import { clearChannelHeatmapMemo, loadChannelHeatmapPayloads } from "@/lib/boards/heatmap-server";
import { loadUnifiedMarket } from "@/lib/boards/composite-desk";
import { liveEntityTypesForBoard } from "@/lib/boards/entity-type";
import {
  HEATMAP_SCREEN_LIVE_CAP,
  countScreenLiveLead,
  isLivePreferEntity,
  isNativeChartBoard,
} from "@/lib/boards/live-priority";
import { menuBoardsForChannel, isHeadlineNewsBoard } from "@/lib/boards/registry";
import { readPersistedSnapshot } from "@/lib/ingestion/job";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity } from "@/lib/types";

function nameKey(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

/** Match overlay ranking names back to snapshot live/native rows for this board. */
function liveNameKeysForBoard(
  slug: string,
  channel: PostChannel,
  items: RankingEntity[],
): Set<string> {
  const types = new Set(liveEntityTypesForBoard(slug));
  const keys = new Set<string>();
  for (const item of items) {
    const key = nameKey(item.name ?? "");
    if (!key) continue;
    const tagged =
      item.tags?.includes(slug) &&
      (item.tags.includes("live-chart") || item.slug.startsWith(`${slug}--`));
    const typedNative = types.has(item.type) && !item.tags?.includes("board-tape");
    const prefer = isLivePreferEntity(item) && (tagged || typedNative || item.sourceChannel === channel);
    if (tagged || typedNative || prefer) keys.add(key);
  }
  return keys;
}

const CHANNELS: PostChannel[] = ["entertainment", "politics", "economy", "culture", "travel"];

function pct(n: number, d: number): string {
  if (!d) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

async function main() {
  clearChannelHeatmapMemo();
  const snapshot = readPersistedSnapshot();
  if (!snapshot?.items?.length) {
    console.error("No snapshot — cannot score LIVE completeness");
    process.exit(1);
  }

  const market = {
    updatedAt: snapshot.updatedAt,
    status: "open" as const,
    indices: snapshot.indices ?? [],
    items: snapshot.items,
  };

  console.log("=== Heatmap LIVE completeness ===");
  console.log(`snapshot updatedAt=${snapshot.updatedAt}`);
  console.log(`screen cap=${HEATMAP_SCREEN_LIVE_CAP} · board store limit≈30\n`);

  const channelSummary: {
    channel: PostChannel;
    liveLead: number;
    fill: number;
    livePct: number;
    fillPct: number;
  }[] = [];

  for (const channel of CHANNELS) {
    const payloads = await loadChannelHeatmapPayloads(channel);
    const menus = menuBoardsForChannel(channel).filter(
      (board) => !board.deskKind && !isHeadlineNewsBoard(board.slug),
    );

    let liveSum = 0;
    let fillSum = 0;
    let boardCount = 0;

    console.log(`## ${channel}`);
    for (const def of menus) {
      const board = payloads.find((row) => row.slug === def.slug);
      const ranking = board?.ranking ?? [];
      const head = ranking.slice(0, HEATMAP_SCREEN_LIVE_CAP);
      // Overlay already merged live+seed; approximate live lead via snapshot names.
      const snapLiveNames = liveNameKeysForBoard(def.slug, channel, snapshot.items);
      const liveInHead = head.filter((row) => snapLiveNames.has(nameKey(row.name ?? ""))).length;
      const fill = head.length;
      liveSum += liveInHead;
      fillSum += fill;
      boardCount += 1;
      const flag = isNativeChartBoard(def.slug) ? " [native]" : "";
      console.log(
        `  ${def.slug}${flag}: live ${liveInHead}/${HEATMAP_SCREEN_LIVE_CAP} (${pct(liveInHead, HEATMAP_SCREEN_LIVE_CAP)}) · fill ${fill}/${HEATMAP_SCREEN_LIVE_CAP}`,
      );
    }

    const livePct = boardCount ? liveSum / (boardCount * HEATMAP_SCREEN_LIVE_CAP) : 0;
    const fillPct = boardCount ? fillSum / (boardCount * HEATMAP_SCREEN_LIVE_CAP) : 0;
    channelSummary.push({
      channel,
      liveLead: liveSum,
      fill: fillSum,
      livePct,
      fillPct,
    });
    console.log(
      `  → channel live≈${pct(livePct, 1)} · screen fill≈${pct(fillPct, 1)} (boards=${boardCount})\n`,
    );
  }

  const unified = await loadUnifiedMarket(market);
  const landingLead = countScreenLiveLead(unified.items);
  console.log("## landing 종합");
  console.log(
    `  screen-20 live lead=${landingLead}/${HEATMAP_SCREEN_LIVE_CAP} (${pct(landingLead, HEATMAP_SCREEN_LIVE_CAP)})`,
  );
  console.log(
    "  top5:",
    unified.items
      .slice(0, 5)
      .map((item) => `${item.name}[${item.sourceChannel ?? "-"}/${item.type}]`)
      .join(", "),
  );

  console.log("\n=== Category summary ===");
  for (const row of channelSummary) {
    console.log(
      `${row.channel.padEnd(14)} live≈${pct(row.livePct, 1).padStart(4)} · fill≈${pct(row.fillPct, 1).padStart(4)}`,
    );
  }
  const avgLive =
    channelSummary.reduce((sum, row) => sum + row.livePct, 0) / Math.max(1, channelSummary.length);
  const avgFill =
    channelSummary.reduce((sum, row) => sum + row.fillPct, 0) / Math.max(1, channelSummary.length);
  console.log(`ALL            live≈${pct(avgLive, 1).padStart(4)} · fill≈${pct(avgFill, 1).padStart(4)}`);
}

void main();
