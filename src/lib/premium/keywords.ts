import { boardRowSlug, stripRowQualifier } from "@/lib/boards/heatmap";
import { BOARDS, isDeskBoard } from "@/lib/boards/registry";
import { readBoard } from "@/lib/boards/store";
import { channelFromEntityType } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";
import { getRankings } from "@/lib/providers/trends";

export interface PremiumTarget {
  keyword: string;
  slug: string;
  channel: PostChannel;
  /** Board or entity label used as the [분류] hint in the prompt. */
  category: string;
  /** Peers on the same board, offered to the model as internal link candidates. */
  related: string[];
  source: "heatmap" | "board";
}

/** Per-board cap. The long tail of a ranking rarely has enough coverage to cite. */
const PER_BOARD = 6;

function clean(name: string | undefined): string {
  return (name ?? "").replace(/\s+/g, " ").trim();
}

/** The qualifier itself is kept as a prompt hint rather than discarded. */
function qualifierOf(raw: string): string | undefined {
  return raw.match(/^\[([^\]]+)\]/)?.[1]?.trim();
}

/**
 * Builds the keyword universe for the rebuild: the live heatmap entities plus
 * the top rows of every registered ranking board. Desk boards are skipped —
 * their tiles are headline links, not keywords a column can be written about.
 */
export async function collectPremiumTargets(options?: {
  channel?: PostChannel;
  limitPerBoard?: number;
}): Promise<PremiumTarget[]> {
  const perBoard = options?.limitPerBoard ?? PER_BOARD;
  const bySlug = new Map<string, PremiumTarget>();

  const market = await getRankings();
  for (const item of market.items) {
    const keyword = clean(item.name);
    if (!keyword) continue;
    const channel = channelFromEntityType(item.type);
    if (options?.channel && channel !== options.channel) continue;
    bySlug.set(item.slug, {
      keyword,
      slug: item.slug,
      channel,
      category: item.tags?.[0] ?? keyword,
      related: [],
      source: "heatmap",
    });
  }

  const boards = BOARDS.filter(
    (board) => !isDeskBoard(board) && (!options?.channel || board.channel === options.channel),
  );

  for (const board of boards) {
    const cached = await readBoard(board.slug);
    const rows = (cached?.ranking ?? []).slice(0, perBoard);
    const peers = rows.map((row) => stripRowQualifier(clean(row.name))).filter(Boolean);

    for (const row of rows) {
      const raw = clean(row.name);
      const keyword = stripRowQualifier(raw);
      const qualifier = qualifierOf(raw);
      if (!keyword) continue;
      // The slug has to be the one the board's own tiles link to, derived from
      // the untouched row name. Keying the article on the cleaned keyword
      // instead stores it at an address no page resolves.
      const slug = boardRowSlug(board.slug, raw);
      if (!slug) continue;
      const existing = bySlug.get(slug);
      const related = peers.filter((peer) => peer !== keyword).slice(0, 4);
      if (existing) {
        bySlug.set(slug, { ...existing, related: existing.related.length ? existing.related : related });
        continue;
      }
      bySlug.set(slug, {
        keyword,
        slug,
        channel: board.channel,
        category: qualifier ? `${board.title} · ${qualifier}` : board.title,
        related,
        source: "board",
      });
    }
  }

  return [...bySlug.values()];
}
