import { enrichBriefingWithAi, enrichChannelEditionWithAi } from "@/lib/briefing/ai-main";
import { hasEdition, listSeeded } from "@/lib/briefing/catalog";
import { composeArticle, composeChannelEdition } from "@/lib/briefing/compose";
import { editionDateTime, kstDateString } from "@/lib/briefing/dates";
import { desksForChannel, isHeadlineBriefingDesk } from "@/lib/briefing/desks";
import { channelUsesBoardBriefing, composeBoardChannelEdition } from "@/lib/briefing/from-boards";
import { collectHeatmapTopics } from "@/lib/briefing/heatmap-topics";
import { persistEdition, removePersistedEdition } from "@/lib/briefing/persist";
import { POST_CHANNELS } from "@/lib/posts/channels";
import { getRankings } from "@/lib/providers/trends";
import type { BriefingArticle } from "@/lib/types";
import type { PostChannel } from "@/lib/posts/types";

function withoutHeadlineDeepDives(articles: BriefingArticle[]): BriefingArticle[] {
  return articles.filter(
    (article) => article.kind === "main" || !isHeadlineBriefingDesk(article.deskId),
  );
}

async function composeChannelDraft(
  channel: PostChannel,
  editionDate: string,
  publishedAt: string,
): Promise<BriefingArticle[]> {
  // Topics always come from the live heatmap at 3m · 전체 · 전체 — never random seeds.
  const topicPool = await collectHeatmapTopics(channel);
  console.log(
    `[briefing] ${channel} heatmap topics: composite=${topicPool.composite.length} desks=${Object.keys(topicPool.byDesk).length} lead=${topicPool.composite[0]?.name ?? "—"}`,
  );
  const draft = channelUsesBoardBriefing(channel)
    ? await composeBoardChannelEdition(channel, editionDate, publishedAt, topicPool)
    : composeChannelEdition(await getRankings(), channel, editionDate, publishedAt, topicPool);

  const expected = new Set(desksForChannel(channel).map((desk) => desk.id));
  const diveIds = new Set(
    draft.filter((article) => article.kind === "deep-dive").map((article) => article.deskId),
  );
  for (const deskId of expected) {
    if (!diveIds.has(deskId)) {
      console.warn(`[briefing] ${channel} missing deep-dive desk: ${deskId}`);
    }
  }

  return withoutHeadlineDeepDives(draft);
}

/** Composes and Gemini-enriches every briefing for one channel (main + deep-dives). */
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
 * Generates the full daily edition across all five channels (main + rail
 * deep-dives; headlines desks excluded) using the premium Gemini pipeline.
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

  if (persist) {
    const result = await persistEdition(articles);
    if (result.skipped > 0) {
      console.warn(
        `[briefing] skipped ${result.skipped} template/failed articles; persisted ${result.kept}`,
      );
    }
  }
  return articles;
}

export async function generateSingle(
  editionDate: string,
  kind: BriefingArticle["kind"],
  category: BriefingArticle["category"],
  channel: PostChannel = "entertainment",
): Promise<BriefingArticle> {
  const publishedAt = editionDateTime(editionDate, 7, kind === "main" ? 5 : 20);
  const [payload, topicPool] = await Promise.all([getRankings(), collectHeatmapTopics(channel)]);
  const base = composeArticle(payload, {
    editionDate,
    kind,
    category,
    publishedAt,
    channel,
    topicPool,
    deskId: kind === "main" ? `${channel}-daily` : undefined,
  });
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
