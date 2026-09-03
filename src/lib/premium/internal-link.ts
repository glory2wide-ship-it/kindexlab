/**
 * Canonical internal links for premium / briefing "교차확인 자료".
 *
 * `/search?q=` often returns zero hits and looks like a dead page to readers
 * and crawlers. Cross-check links must land on a real board, briefing index,
 * channel desk, or ranking entity route that the app always serves.
 */

import { boardPath, getBoard } from "@/lib/boards/registry";
import { channelSectionHref, getPostChannel, isPostChannel } from "@/lib/posts/channels";
import type { PostChannel, PostLink } from "@/lib/posts/types";
import { rankingPath } from "@/lib/slugs";

const CHANNELS = new Set(["entertainment", "politics", "economy", "culture", "travel"]);

/** Paths that always resolve to a real screen (not a query-parameter search). */
export function isStableInternalHref(href: string | undefined | null): boolean {
  if (!href?.startsWith("/")) return false;
  if (href.startsWith("/search")) return false;
  if (href.startsWith("//")) return false;

  if (/^\/board\/[a-z0-9-]+\/?$/i.test(href)) {
    const slug = href.replace(/^\/board\//i, "").replace(/\/$/, "");
    return Boolean(getBoard(slug));
  }
  if (/^\/ranking\/[^/?#]+\/?$/i.test(href)) return true;
  if (/^\/(entertainment|politics|economy|culture|travel)(\/|$)/i.test(href)) return true;
  if (/^\/briefing(\/|$)/i.test(href)) return true;
  if (/^\/posts(\/|$)/i.test(href)) return true;
  if (/^\/approval(\/|$)/i.test(href)) return true;
  if (/^\/index\/[^/?#]+\/?$/i.test(href)) return true;
  if (/^\/category\/(entertainment|politics|economy|culture|travel)\/?$/i.test(href)) return true;
  return false;
}

function channelHomeLink(channel: PostChannel): PostLink {
  const meta = getPostChannel(channel);
  return {
    href: meta.href,
    label: `${meta.label} 지수 · 브리핑`,
  };
}

function channelBriefingLink(channel: PostChannel): PostLink {
  const meta = getPostChannel(channel);
  return {
    href: channelSectionHref(channel, "briefing"),
    label: `${meta.label} 일일브리핑`,
  };
}

function boardDeskLink(deskId: string, _labelHint?: string): PostLink | null {
  const board = getBoard(deskId);
  if (!board) return null;
  return {
    href: boardPath(board.slug),
    label: `${board.shortTitle} 랭킹 보드`,
  };
}

/**
 * Picks a clickable internal destination that the site actually serves.
 * Prefer caller-supplied stable links (draft board path, peer ranking, etc.).
 */
export function resolveInternalLink(input: {
  preferred?: PostLink | null;
  fromModel?: PostLink | null;
  channel?: string | null;
  deskId?: string | null;
  relatedEntitySlug?: string | null;
  relatedEntityLabel?: string | null;
  labelHint?: string | null;
}): PostLink {
  const candidates: Array<PostLink | null | undefined> = [
    input.preferred,
    input.fromModel,
  ];

  for (const candidate of candidates) {
    if (candidate?.href && isStableInternalHref(candidate.href)) {
      return {
        href: candidate.href,
        label:
          candidate.label?.trim() ||
          input.labelHint?.trim() ||
          "관련 자료 더 보기",
      };
    }
  }

  if (input.deskId) {
    const board = boardDeskLink(input.deskId, input.labelHint ?? undefined);
    if (board) return board;
  }

  if (input.relatedEntitySlug?.trim()) {
    return {
      href: rankingPath(input.relatedEntitySlug.trim()),
      label:
        input.relatedEntityLabel?.trim() ||
        input.labelHint?.trim() ||
        "관련 지수 항목",
    };
  }

  if (input.channel && isPostChannel(input.channel)) {
    if (CHANNELS.has(input.channel)) {
      return channelBriefingLink(input.channel);
    }
  }

  if (input.channel && isPostChannel(input.channel)) {
    return channelHomeLink(input.channel);
  }

  return {
    href: "/briefing",
    label: input.labelHint?.trim() || "일일브리핑 전체",
  };
}

/** Infer desk id from a briefing slug like `2026-09-03-economy-government-subsidy-search`. */
export function deskIdFromBriefingSlug(slug: string, channel?: string | null): string | undefined {
  const datePrefix = slug.match(/^\d{4}-\d{2}-\d{2}-/);
  if (!datePrefix) return undefined;
  let rest = slug.slice(datePrefix[0].length);
  if (channel && rest.startsWith(`${channel}-`)) {
    rest = rest.slice(channel.length + 1);
  }
  if (!rest || rest === "daily") return undefined;
  return getBoard(rest) ? rest : undefined;
}
