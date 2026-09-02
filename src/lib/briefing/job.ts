import { enrichBriefingWithAi, enrichChannelEditionWithAi } from "@/lib/briefing/ai-main";
import { hasEdition, listSeeded } from "@/lib/briefing/catalog";
import { composeArticle, composeChannelEdition } from "@/lib/briefing/compose";
import { editionDateTime, kstDateString } from "@/lib/briefing/dates";
import { channelUsesBoardBriefing, composeBoardChannelEdition } from "@/lib/briefing/from-boards";
import { persistEdition, removePersistedEdition } from "@/lib/briefing/persist";
import { POST_CHANNELS } from "@/lib/posts/channels";
import { getRankings } from "@/lib/providers/trends";
import type { BriefingArticle } from "@/lib/types";
import type { PostChannel } from "@/lib/posts/types";

async function composeChannelDraft(
  channel: PostChannel,
  editionDate: string,
  publishedAt: string,
): Promise<BriefingArticle[]> {
  if (channelUsesBoardBriefing(channel)) {
    return composeBoardChannelEdition(channel, editionDate, publishedAt);
  }
  const payload = await getRankings();
  return composeChannelEdition(payload, channel, editionDate, publishedAt);
}

/** Composes and OpenAI-enriches every briefing for one channel (main + deep-dives). */
export async function composeChannelEditionWithAi(
  channel: PostChannel,
  editionDate: string,
  publishedAt?: string,
): Promise<BriefingArticle[]> {
  const at = publishedAt ?? editionDateTime(editionDate);
  const draft = await composeChannelDraft(channel, editionDate, at);
  return enrichChannelEditionWithAi(draft);
}

/**
 * Generates the full daily edition across all five channels (46 articles on
 * current desk counts) using the premium OpenAI pipeline.
 */
export async function generateEdition(
  editionDate = kstDateString(),
  persist = false,
  options?: {
    onChannel?: (channel: PostChannel, count: number) => void;
    channels?: PostChannel[];
  },
): Promise<BriefingArticle[]> {
  const publishedAt = editionDateTime(editionDate);
  const articles: BriefingArticle[] = [];
  const targets = options?.channels?.length
    ? POST_CHANNELS.filter(({ id }) => options.channels!.includes(id))
    : POST_CHANNELS;

  for (const { id: channel } of targets) {
    const enriched = await composeChannelEditionWithAi(channel, editionDate, publishedAt);
    articles.push(...enriched);
    options?.onChannel?.(channel, enriched.length);
  }

  if (persist) await persistEdition(articles);
  return articles;
}

export async function generateSingle(
  editionDate: string,
  kind: BriefingArticle["kind"],
  category: BriefingArticle["category"],
  channel: PostChannel = "entertainment",
): Promise<BriefingArticle> {
  const publishedAt = editionDateTime(editionDate, 7, kind === "main" ? 5 : 20);
  const payload = await getRankings();
  const base = composeArticle(payload, { editionDate, kind, category, publishedAt, channel });
  return enrichBriefingWithAi(base, {
    leadKeyword: base.focusKeyword,
    categoryHint: channel,
  });
}

export async function runDailyBriefingJob(options?: {
  persist?: boolean;
  force?: boolean;
  editionDate?: string;
  channels?: PostChannel[];
  onChannel?: (channel: PostChannel, count: number) => void;
}): Promise<{
  skipped: boolean;
  reason?: string;
  editionDate: string;
  persisted: boolean;
  removed: number;
  articles: BriefingArticle[];
}> {
  const editionDate = options?.editionDate ?? kstDateString();
  if (!options?.force && hasEdition(editionDate)) {
    return {
      skipped: true,
      reason: "edition already published",
      editionDate,
      persisted: false,
      removed: 0,
      articles: listSeeded().filter((item) => item.editionDate === editionDate),
    };
  }

  const removed =
    options?.force && !options.channels?.length ? await removePersistedEdition(editionDate) : 0;
  const persist = options?.persist ?? true;
  const articles = await generateEdition(editionDate, persist, {
    onChannel: options?.onChannel,
    channels: options?.channels,
  });
  return {
    skipped: false,
    editionDate,
    persisted: persist,
    removed,
    articles,
  };
}
