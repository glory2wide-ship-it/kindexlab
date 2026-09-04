import { enrichBriefingWithAi, enrichChannelEditionWithAi } from "@/lib/briefing/ai-main";
import { hasEdition, listSeeded } from "@/lib/briefing/catalog";
import { composeArticle, composeChannelEdition } from "@/lib/briefing/compose";
import { editionDateTime, kstDateString } from "@/lib/briefing/dates";
import { desksForChannel, isHeadlineBriefingDesk } from "@/lib/briefing/desks";
import { channelUsesBoardBriefing, composeBoardChannelEdition } from "@/lib/briefing/from-boards";
import { collectHeatmapTopics } from "@/lib/briefing/heatmap-topics";
import { persistEdition, removePersistedEdition } from "@/lib/briefing/persist";
import { isPersistableBriefing } from "@/lib/briefing/quality";
import { geminiBatchEnabled, briefingProvider } from "@/lib/analysis/chain/llm";
import { POST_CHANNELS } from "@/lib/posts/channels";
import { getRankings } from "@/lib/providers/trends";
import type { BriefingArticle } from "@/lib/types";
import type { PostChannel } from "@/lib/posts/types";

export interface BriefingGenerationOutcome {
  name: string;
  title: string;
  kind: "main" | "deep-dive";
  channel: string;
  deskLabel?: string;
  slug: string;
  status: "ok" | "fail";
  reason?: string;
}

function withoutHeadlineDeepDives(articles: BriefingArticle[]): BriefingArticle[] {
  return articles.filter(
    (article) => article.kind === "main" || !isHeadlineBriefingDesk(article.deskId),
  );
}

function briefingFailReason(article: BriefingArticle): string {
  if (!article.bodyHtml?.trim() && !article.bodyMarkdown?.trim()) return "not-gemini";
  return "quality-gate";
}

function outcomeFromArticle(article: BriefingArticle): BriefingGenerationOutcome {
  const ok = isPersistableBriefing(article);
  return {
    name: article.focusKeyword?.trim() || article.title,
    title: article.title,
    kind: article.kind === "main" ? "main" : "deep-dive",
    channel: article.channel ?? "",
    deskLabel: article.deskLabel,
    slug: article.slug,
    status: ok ? "ok" : "fail",
    reason: ok ? undefined : briefingFailReason(article),
  };
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
  options?: { useGeminiBatch?: boolean },
): Promise<BriefingArticle[]> {
  const at = publishedAt ?? editionDateTime(editionDate);
  const draft = await composeChannelDraft(channel, editionDate, at);
  return enrichChannelEditionWithAi(draft, { forceGeminiBatch: options?.useGeminiBatch });
}

/**
 * Generates the full daily edition across all five channels (main + rail
 * deep-dives; headlines desks excluded) using the premium Gemini pipeline.
 *
 * Overnight: compose every channel first, then enrich mains + deep-dives in one
 * Gemini Batch session (−50%) when `useGeminiBatch` / GEMINI_USE_BATCH is on.
 */
export async function generateEdition(
  editionDate = kstDateString(),
  persist = false,
  options?: {
    onChannel?: (channel: PostChannel, count: number) => void;
    channels?: PostChannel[];
    /** Overnight Batch for mains + submenu deep-dives (−50%). */
    useGeminiBatch?: boolean;
  },
): Promise<{ articles: BriefingArticle[]; outcomes: BriefingGenerationOutcome[] }> {
  const publishedAt = editionDateTime(editionDate);
  const targets = options?.channels?.length
    ? POST_CHANNELS.filter(({ id }) => options.channels!.includes(id))
    : POST_CHANNELS;

  const drafts: BriefingArticle[] = [];
  for (const { id: channel } of targets) {
    const channelDrafts = await composeChannelDraft(channel, editionDate, publishedAt);
    drafts.push(...channelDrafts);
    const mains = channelDrafts.filter((item) => item.kind === "main").length;
    const dives = channelDrafts.filter((item) => item.kind === "deep-dive").length;
    console.log(`[briefing] ${channel} drafted mains=${mains} deep-dives=${dives}`);
  }

  const articles = await enrichChannelEditionWithAi(drafts, {
    forceGeminiBatch: options?.useGeminiBatch,
  });
  const outcomes = articles.map(outcomeFromArticle);

  for (const { id: channel } of targets) {
    options?.onChannel?.(
      channel,
      articles.filter((item) => item.channel === channel && isPersistableBriefing(item)).length,
    );
  }

  if (persist) {
    const result = await persistEdition(articles);
    if (result.skipped > 0) {
      console.warn(
        `[briefing] skipped ${result.skipped} template/failed articles; persisted ${result.kept}`,
      );
    }
  }
  // Never hand template shells to display callers — Gemini columns only.
  return {
    articles: articles.filter(isPersistableBriefing),
    outcomes,
  };
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
  /** Overnight: Gemini Batch for daily mains + submenu deep-dives. */
  useGeminiBatch?: boolean;
}): Promise<{
  skipped: boolean;
  reason?: string;
  editionDate: string;
  persisted: boolean;
  removed: number;
  articles: BriefingArticle[];
  outcomes: BriefingGenerationOutcome[];
  geminiBatch?: boolean;
}> {
  const editionDate = options?.editionDate ?? kstDateString();
  if (!options?.force && hasEdition(editionDate)) {
    const existing = listSeeded().filter((item) => item.editionDate === editionDate);
    return {
      skipped: true,
      reason: "edition already published",
      editionDate,
      persisted: false,
      removed: 0,
      articles: existing.filter(isPersistableBriefing),
      outcomes: existing.map((article) => ({
        name: article.focusKeyword?.trim() || article.title,
        title: article.title,
        kind: (article.kind === "main" ? "main" : "deep-dive") as "main" | "deep-dive",
        channel: article.channel ?? "",
        deskLabel: article.deskLabel,
        slug: article.slug,
        status: "ok" as const,
        reason: "already-published",
      })),
      geminiBatch: false,
    };
  }

  const removed =
    options?.force && !options.channels?.length ? await removePersistedEdition(editionDate) : 0;
  const persist = options?.persist ?? true;
  const useGeminiBatch =
    Boolean(options?.useGeminiBatch) ||
    (geminiBatchEnabled() && briefingProvider() === "gemini");
  const { articles, outcomes } = await generateEdition(editionDate, persist, {
    onChannel: options?.onChannel,
    channels: options?.channels,
    useGeminiBatch: options?.useGeminiBatch,
  });
  return {
    skipped: false,
    editionDate,
    persisted: persist,
    removed,
    articles,
    outcomes,
    geminiBatch: useGeminiBatch,
  };
}
