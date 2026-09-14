/**
 * Heatmap LIVE fill by channel — shared by `npm run live:completeness` and /admin.
 * live% = snapshot-matched live-prefer rows in the painted screen head (top N).
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
import { POST_CHANNELS } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity } from "@/lib/types";

export type LiveFillLevel = "ok" | "warn" | "fail";

export interface LiveFillBoardRow {
  slug: string;
  native: boolean;
  liveInHead: number;
  fill: number;
  livePct: number;
  fillPct: number;
  level: LiveFillLevel;
}

export interface LiveFillChannelRow {
  channel: PostChannel;
  label: string;
  boardCount: number;
  liveLead: number;
  fill: number;
  livePct: number;
  fillPct: number;
  level: LiveFillLevel;
  detail: string;
  boards: LiveFillBoardRow[];
}

export interface LiveCompletenessReport {
  checkedAt: string;
  windowHours: 1;
  level: LiveFillLevel;
  snapshotUpdatedAt: string | null;
  snapshotAgeMinutes: number | null;
  snapshotItems: number;
  screenCap: number;
  landingLiveLead: number;
  landingLivePct: number;
  channels: LiveFillChannelRow[];
  notes: string[];
}

const HOUR_MS = 60 * 60 * 1000;

function nameKey(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

function worst(levels: LiveFillLevel[]): LiveFillLevel {
  if (levels.includes("fail")) return "fail";
  if (levels.includes("warn")) return "warn";
  return "ok";
}

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
    const prefer =
      isLivePreferEntity(item) && (tagged || typedNative || item.sourceChannel === channel);
    if (tagged || typedNative || prefer) keys.add(key);
  }
  return keys;
}

function channelLevel(livePct: number, fillPct: number): LiveFillLevel {
  if (fillPct < 0.5 || livePct < 0.2) return "fail";
  if (fillPct < 0.85 || livePct < 0.45) return "warn";
  return "ok";
}

function channelLabel(channel: PostChannel): string {
  return POST_CHANNELS.find((row) => row.id === channel)?.label ?? channel;
}

export async function evaluateLiveCompleteness(): Promise<LiveCompletenessReport> {
  clearChannelHeatmapMemo();
  const notes: string[] = [];
  const snapshot = readPersistedSnapshot();
  const updatedAt = snapshot?.updatedAt ?? null;
  const ageMs = updatedAt ? Date.now() - new Date(updatedAt).getTime() : null;
  const ageMinutes = ageMs != null ? Number((ageMs / 60_000).toFixed(1)) : null;
  const items = snapshot?.items ?? [];

  if (!snapshot?.items?.length) {
    notes.push("ingestion snapshot 없음 — LIVE 채움 측정 불가");
    return {
      checkedAt: new Date().toISOString(),
      windowHours: 1,
      level: "fail",
      snapshotUpdatedAt: updatedAt,
      snapshotAgeMinutes: ageMinutes,
      snapshotItems: 0,
      screenCap: HEATMAP_SCREEN_LIVE_CAP,
      landingLiveLead: 0,
      landingLivePct: 0,
      channels: [],
      notes,
    };
  }

  const channels: LiveFillChannelRow[] = [];

  for (const meta of POST_CHANNELS) {
    const channel = meta.id;
    const payloads = await loadChannelHeatmapPayloads(channel);
    const menus = menuBoardsForChannel(channel).filter(
      (board) => !board.deskKind && !isHeadlineNewsBoard(board.slug),
    );

    let liveSum = 0;
    let fillSum = 0;
    const boards: LiveFillBoardRow[] = [];

    for (const def of menus) {
      const board = payloads.find((row) => row.slug === def.slug);
      const ranking = board?.ranking ?? [];
      const head = ranking.slice(0, HEATMAP_SCREEN_LIVE_CAP);
      const snapLiveNames = liveNameKeysForBoard(def.slug, channel, items);
      const liveInHead = head.filter((row) => snapLiveNames.has(nameKey(row.name ?? ""))).length;
      const fill = head.length;
      liveSum += liveInHead;
      fillSum += fill;
      const livePct = liveInHead / HEATMAP_SCREEN_LIVE_CAP;
      const fillPct = fill / HEATMAP_SCREEN_LIVE_CAP;
      boards.push({
        slug: def.slug,
        native: isNativeChartBoard(def.slug),
        liveInHead,
        fill,
        livePct,
        fillPct,
        level: channelLevel(livePct, fillPct),
      });
    }

    const boardCount = menus.length;
    const livePct = boardCount ? liveSum / (boardCount * HEATMAP_SCREEN_LIVE_CAP) : 0;
    const fillPct = boardCount ? fillSum / (boardCount * HEATMAP_SCREEN_LIVE_CAP) : 0;
    const level = channelLevel(livePct, fillPct);
    channels.push({
      channel,
      label: channelLabel(channel),
      boardCount,
      liveLead: liveSum,
      fill: fillSum,
      livePct,
      fillPct,
      level,
      detail: `LIVE ${Math.round(livePct * 100)}% · 화면 채움 ${Math.round(fillPct * 100)}% · 보드 ${boardCount}`,
      boards,
    });
  }

  const market = {
    updatedAt: snapshot.updatedAt,
    status: "open" as const,
    indices: snapshot.indices ?? [],
    items,
  };
  const unified = await loadUnifiedMarket(market);
  const landingLiveLead = countScreenLiveLead(unified.items);
  const landingLivePct = landingLiveLead / HEATMAP_SCREEN_LIVE_CAP;

  const levels: LiveFillLevel[] = channels.map((row) => row.level);
  if (ageMs == null) {
    levels.push("fail");
    notes.push("ingestion snapshot 타임스탬프 없음");
  } else if (ageMs > HOUR_MS * 1.25) {
    levels.push("fail");
    notes.push(`스냅샷이 1시간 창을 초과 (${ageMinutes}분)`);
  } else if (ageMs > HOUR_MS) {
    levels.push("warn");
    notes.push(`스냅샷이 약간 지연 (${ageMinutes}분)`);
  }
  if (landingLivePct < 0.25) {
    levels.push("warn");
    notes.push(`랜딩 종합 LIVE lead ${landingLiveLead}/${HEATMAP_SCREEN_LIVE_CAP}`);
  }

  return {
    checkedAt: new Date().toISOString(),
    windowHours: 1,
    level: worst(levels),
    snapshotUpdatedAt: updatedAt,
    snapshotAgeMinutes: ageMinutes,
    snapshotItems: items.length,
    screenCap: HEATMAP_SCREEN_LIVE_CAP,
    landingLiveLead,
    landingLivePct,
    channels,
    notes,
  };
}
