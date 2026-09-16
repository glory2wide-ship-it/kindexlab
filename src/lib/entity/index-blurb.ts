import { TYPE_LABEL } from "@/lib/format";
import type { PostChannel } from "@/lib/posts/types";
import type { RankingEntity } from "@/lib/types";

const SLUG_LIKE = /^[a-z0-9]+(?:-[a-z0-9]+)+$/i;

/** Structured rank/등락 one-liner stamped onto `entity.summary` by ingest/heatmap. */
const INDEX_BLURB_PATTERN =
  /^.+?(은|는)\s+.+\s+기준\s+\d+위입니다\.\s*등락\s+-?\d+(?:\.\d+)?%\.?\s*$/u;
const INDEX_BLURB_INLINE =
  /[^\n]*?(은|는)\s+[^\n]*?\s+기준\s+\d+위입니다\.\s*등락\s+-?\d+(?:\.\d+)?%\.?/gu;

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

/** True when text is (or duplicates) the structured index blurb — not a real synopsis. */
export function isEntityIndexBlurbText(text: string | undefined | null): boolean {
  const trimmed = text?.trim();
  if (!trimmed) return false;
  // Exact structured line, or the same line repeated / joined with a separator.
  const parts = trimmed
    .split(/\s*\/\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2 && parts.every((part) => INDEX_BLURB_PATTERN.test(part))) {
    return true;
  }
  return INDEX_BLURB_PATTERN.test(trimmed);
}

/**
 * Strip scheduled refresh boilerplate so detail cards only keep real synopsis.
 */
export function stripRefreshBoilerplate(text: string | undefined | null): string | undefined {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;
  // Drop cadence / refresh notice sentences anywhere in the copy.
  const withoutCadence = trimmed
    .replace(
      /[^.。\n]*?(정보|시놉시스|뉴스는?|링크는?)\s*(는|은)?\s*(하루\s*1회|주\s*1회|3일마다|주기적으로)?\s*(점검|갱신)(합니다|됩니다)\.?/gu,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (!withoutCadence) return undefined;
  if (
    /정보는\s*(하루\s*1회|주\s*1회|3일마다)\s*(점검|갱신)합니다\.?\s*$/u.test(trimmed) ||
    /정보는\s*주\s*1회\s*갱신됩니다\.?\s*$/u.test(trimmed) ||
    /줄거리·캐릭터 정보는\s*주\s*1회/u.test(trimmed) ||
    /멤버·소속사·히트곡 정보는\s*주\s*1회/u.test(trimmed) ||
    /아티스트·소속사 정보는\s*주\s*1회/u.test(trimmed) ||
    /소속사·출연작품 정보는\s*주\s*1회/u.test(trimmed) ||
    /출연진·시놉시스는\s*주\s*1회/u.test(trimmed) ||
    /출연·시놉시스·티켓 정보는\s*주\s*1회/u.test(trimmed) ||
    /장소·시간·입장료 정보는\s*주\s*1회/u.test(trimmed) ||
    /작가·출판사·요약·관련 뉴스는\s*3일마다/u.test(trimmed) ||
    /채널 URL과 최근 이슈 영상 정보는\s*3일마다/u.test(trimmed) ||
    /맛집 추천 정보는\s*하루\s*1회/u.test(trimmed) ||
    /나들이 정보는\s*하루\s*1회/u.test(trimmed) ||
    /관련 최근 뉴스 링크는\s*하루\s*1회/u.test(trimmed)
  ) {
    return undefined;
  }
  return withoutCadence;
}

/**
 * Narrative copy only. Index blurbs must never appear as 프로필 시놉시스 / TV 줄거리.
 */
export function entityNarrativeSummary(
  entity: Pick<RankingEntity, "summary"> | string | undefined | null,
): string | undefined {
  const raw = typeof entity === "string" || entity == null ? entity : entity.summary;
  let trimmed = raw?.trim();
  if (!trimmed) return undefined;
  if (isEntityIndexBlurbText(trimmed)) return undefined;
  trimmed = trimmed.replace(INDEX_BLURB_INLINE, " ").replace(/\s+/g, " ").trim();
  if (!trimmed || isEntityIndexBlurbText(trimmed)) return undefined;
  return stripRefreshBoilerplate(trimmed);
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
    const narrative = entityNarrativeSummary(entity);
    return narrative || `${entity.name} 순위 데이터를 확인하는 중입니다.`;
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
