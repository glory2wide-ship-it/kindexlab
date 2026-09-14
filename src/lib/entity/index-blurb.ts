import { TYPE_LABEL } from "@/lib/format";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity } from "@/lib/types";

const SLUG_LIKE = /^[a-z0-9]+(?:-[a-z0-9]+)+$/i;

const CHANNEL_LABEL: Record<PostChannel, string> = {
  entertainment: "엔터",
  politics: "정치",
  economy: "경제",
  culture: "문화/생활",
  travel: "여행/맛집",
};

function topicJosa(word: string): "은" | "는" {
  const last = word.at(-1);
  if (!last) return "는";
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "는";
  return (code - 0xac00) % 28 === 0 ? "는" : "은";
}

/** Humanize a board slug when no heatmap group is stamped on the entity. */
function humanizeTag(tag: string): string | undefined {
  if (!tag || !SLUG_LIKE.test(tag)) return tag || undefined;
  return tag
    .split("-")
    .filter(Boolean)
    .map((part) => part.toUpperCase())
    .join(" ");
}

function boardTitleFromTags(tags: string[], entityName?: string): string | undefined {
  const skip = new Set(
    ["live-chart", "board-tape", entityName?.trim()].filter(Boolean) as string[],
  );
  for (const tag of tags) {
    if (skip.has(tag)) continue;
    if (!SLUG_LIKE.test(tag)) return tag;
  }
  for (const tag of tags) {
    if (skip.has(tag)) continue;
    const title = humanizeTag(tag);
    if (title) return title;
  }
  return undefined;
}

/**
 * Scope label for the short index line above the chart.
 * Live-tape rows are re-ranked across the whole desk after ingest, so their
 * `rank` is a composite position — never claim a single-board "1위" for them.
 * Board-cache rows (`board:…` / `slug--name`) keep the board short title.
 *
 * Kept free of registry/editorial imports so detail pages stay static-safe.
 */
export function entityIndexScopeLabel(entity: RankingEntity): string {
  const boardScoped =
    entity.id.startsWith("board:") ||
    entity.slug.includes("--") ||
    entity.tags.includes("board-tape");

  if (boardScoped) {
    const group = entity.heatmapGroup?.trim();
    if (group && group !== entity.name) return group;
    const fromTags = boardTitleFromTags(entity.tags, entity.name);
    if (fromTags) return fromTags;
    if (entity.slug.includes("--")) {
      const boardSlug = entity.slug.slice(0, entity.slug.indexOf("--"));
      const fromSlug = humanizeTag(boardSlug);
      if (fromSlug) return fromSlug;
    }
    return TYPE_LABEL[entity.type] || "보드";
  }

  if (entity.id.startsWith("live-") || entity.tags.includes("live-chart")) {
    const channel = entity.sourceChannel
      ? CHANNEL_LABEL[entity.sourceChannel]
      : undefined;
    return channel ? `${channel} 종합` : "종합 히트맵";
  }

  const group = entity.heatmapGroup?.trim();
  if (group && group !== entity.name) return group;
  return (
    boardTitleFromTags(entity.tags, entity.name) ||
    TYPE_LABEL[entity.type] ||
    "히트맵"
  );
}

/** Short index blurb — always mirrors current `rank` / `fluctuationRate`. */
export function formatEntityIndexBlurb(entity: RankingEntity): string {
  // Keyword placeholders must never claim a fabricated board "1위".
  if (
    entity.rank <= 0 ||
    entity.id.startsWith("keyword:") ||
    entity.tags.includes("rank-pending")
  ) {
    return entity.summary?.trim() || `${entity.name} 순위 데이터를 확인하는 중입니다.`;
  }
  const scope = entityIndexScopeLabel(entity);
  const particle = topicJosa(entity.name);
  let rate = Number.isFinite(entity.fluctuationRate) ? entity.fluctuationRate : 0;
  // Older snapshots kept board-local 0% even after desk-wide re-rank.
  if (rate === 0 && entity.previousRank !== entity.rank) {
    rate = Number(
      (((entity.previousRank - entity.rank) / Math.max(entity.previousRank, 1)) * 12).toFixed(2),
    );
  }
  return `${entity.name}${particle} ${scope} 기준 ${entity.rank}위입니다. 등락 ${rate.toFixed(2)}%.`;
}
