import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DETAIL_FACTS_DAILY_CHECKED_AT } from "@/lib/boards/detail-facts";
import { ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT } from "@/lib/boards/entertainment-facts";
import {
  CATEGORY_INFO_REFRESH_TIERS,
  resolveCategoryInfoRefreshTier,
  type CategoryInfoRefreshTierId,
} from "@/lib/entity/category-info/refresh-policy";
import type { CategoryInfoChannel } from "@/lib/entity/category-info/types";

export type CategoryInfoRefreshTierStatus = {
  id: CategoryInfoRefreshTierId;
  label: string;
  cadenceLabel: string;
  reason: string;
  channelsLabel: string;
  intervalMs: number;
  lastUpdatedAt: string;
  nextUpdateAt: string;
  overdue: boolean;
};

type RefreshStateFile = {
  updatedAt: string;
  tiers: Partial<Record<CategoryInfoRefreshTierId, string>>;
};

const STATE_PATH = path.join(process.cwd(), "src/data/ops/category-info-refresh.json");
const TOUCH_DEBOUNCE_MS = 5 * 60 * 1000;

function defaultLastFor(id: CategoryInfoRefreshTierId): string {
  if (id === "live_signal" || id === "ticket_food" || id === "media_catalog") {
    return DETAIL_FACTS_DAILY_CHECKED_AT;
  }
  if (id === "entertainment_curated") {
    return ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT;
  }
  return new Date().toISOString();
}

function readState(): RefreshStateFile {
  try {
    if (!existsSync(STATE_PATH)) {
      return { updatedAt: new Date().toISOString(), tiers: {} };
    }
    const raw = JSON.parse(readFileSync(STATE_PATH, "utf8")) as RefreshStateFile;
    return {
      updatedAt: raw.updatedAt || new Date().toISOString(),
      tiers: raw.tiers ?? {},
    };
  } catch {
    return { updatedAt: new Date().toISOString(), tiers: {} };
  }
}

function writeState(state: RefreshStateFile): void {
  mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function pickLater(a?: string, b?: string): string | undefined {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta >= tb ? a : b;
  if (Number.isFinite(ta)) return a;
  if (Number.isFinite(tb)) return b;
  return a || b;
}

function computeNext(
  lastIso: string,
  intervalMs: number,
  nowMs: number,
): { nextUpdateAt: string; overdue: boolean } {
  const lastMs = Date.parse(lastIso);
  if (!Number.isFinite(lastMs)) {
    return {
      nextUpdateAt: new Date(nowMs + intervalMs).toISOString(),
      overdue: true,
    };
  }
  const due = lastMs + intervalMs;
  if (due <= nowMs) {
    return {
      nextUpdateAt: new Date(nowMs).toISOString(),
      overdue: true,
    };
  }
  return {
    nextUpdateAt: new Date(due).toISOString(),
    overdue: false,
  };
}

const CHANNEL_LABEL: Partial<Record<CategoryInfoChannel, string>> = {
  housing: "부동산",
  stock: "주식",
  finance: "금융",
  overseas_stock: "해외주식",
  commodities_fx: "원자재·환율",
  inflation: "물가",
  music: "음원",
  gov_subsidy: "보조금",
  travel_grant: "여행지원",
  local_policy: "지자체",
  startup: "창업",
  issue_keyword: "이슈",
  party_support: "정당",
  politician_support: "정치인",
  performance: "공연",
  exhibition: "전시",
  food: "맛집",
  webtoon: "웹툰",
  book: "도서",
  youtuber: "유튜브",
  politics_youtube: "정치유튜브",
  kpop: "K-POP",
  trot: "트로트",
  star: "스타",
  movie: "영화",
  tv_ratings: "시청률",
  weekend_outing: "나들이",
  domestic_travel: "국내여행",
  overseas_travel: "해외여행",
  generic: "기타",
  game: "게임",
  health: "건강",
  recipe: "레시피",
  car: "자동차",
  political_pundit: "평론",
};

function channelLabels(channels: readonly CategoryInfoChannel[]): string {
  if (!channels.length) return "—";
  return channels
    .map((ch) => CHANNEL_LABEL[ch] ?? ch)
    .slice(0, 10)
    .join(" · ");
}

/** Snapshot for /admin — last/next update per recommended tier. */
export function buildCategoryInfoRefreshStatus(
  now = Date.now(),
): CategoryInfoRefreshTierStatus[] {
  const state = readState();
  // Keep curated anchors aligned with catalogue stamps when newer.
  state.tiers.live_signal = pickLater(state.tiers.live_signal, DETAIL_FACTS_DAILY_CHECKED_AT);
  state.tiers.ticket_food = pickLater(state.tiers.ticket_food, DETAIL_FACTS_DAILY_CHECKED_AT);
  state.tiers.media_catalog = pickLater(
    state.tiers.media_catalog,
    DETAIL_FACTS_DAILY_CHECKED_AT,
  );
  state.tiers.entertainment_curated = pickLater(
    state.tiers.entertainment_curated,
    ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT,
  );

  return CATEGORY_INFO_REFRESH_TIERS.map((tier) => {
    const lastUpdatedAt = state.tiers[tier.id] || defaultLastFor(tier.id);
    const { nextUpdateAt, overdue } = computeNext(lastUpdatedAt, tier.intervalMs, now);
    return {
      id: tier.id,
      label: tier.label,
      cadenceLabel: tier.cadenceLabel,
      reason: tier.reason,
      channelsLabel: channelLabels(tier.channels),
      intervalMs: tier.intervalMs,
      lastUpdatedAt,
      nextUpdateAt,
      overdue,
    };
  });
}

/**
 * Touch a tier's lastUpdatedAt when live enrich succeeds.
 * Debounced to at most once per 5 minutes per tier to avoid disk thrash.
 */
export function touchCategoryInfoRefreshTier(channel: CategoryInfoChannel): void {
  const tier = resolveCategoryInfoRefreshTier(channel);
  const state = readState();
  const prev = state.tiers[tier.id];
  const prevMs = prev ? Date.parse(prev) : 0;
  const now = Date.now();
  if (Number.isFinite(prevMs) && now - prevMs < TOUCH_DEBOUNCE_MS) return;
  const iso = new Date(now).toISOString();
  state.tiers[tier.id] = iso;
  state.updatedAt = iso;
  try {
    writeState(state);
  } catch {
    /* soft — admin can still show catalogue anchors */
  }
}
