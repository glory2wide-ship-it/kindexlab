import {
  analysisPromptChannel,
  usesBriefingAnalysisPrompt,
} from "@/lib/analysis/briefing-boards";
import { draftColumn } from "@/lib/analysis/chain/draft";
import { summarizeFacts } from "@/lib/analysis/chain/facts";
import { reviewColumn } from "@/lib/analysis/chain/editor";
import { llmConfigured, llmModel } from "@/lib/analysis/chain/llm";
import { buildTrafficPump, type TrafficPump } from "@/lib/analysis/chain/pump";
import { analysisLogger } from "@/lib/analysis/log";
import {
  analysisTtlHours,
  isExpired,
  readAnalysis,
  writeAnalysis,
  type AnalysisProvenance,
  type CachedAnalysis,
} from "@/lib/analysis/store";
import { kstDateString } from "@/lib/briefing/dates";
import { pickIssueKeywords } from "@/lib/editorial/copy";
import { issueKeywordFromEntity } from "@/lib/editorial/issue-keyword";
import {
  composeTodayAnalysis,
  evaluateTodayAnalysis,
  type TodayAnalysisArticle,
  type TodayAnalysisOverride,
} from "@/lib/editorial/today-analysis";
import { TYPE_LABEL } from "@/lib/format";
import { findTrafficChannelByName } from "@/lib/ingestion/channels";
import { canGenerateContext } from "@/lib/context/score";
import { collectArticleContext } from "@/lib/context/collect-context";
import type { ContextSource } from "@/lib/context/types";
import type { NewsDoc, NewsSourceId } from "@/lib/news/types";
import { SITE } from "@/lib/site";
import { rankingPath } from "@/lib/slugs";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

/** @deprecated Hybrid gate uses canGenerateContext (score >= 6 + 1 URL). */
const MIN_DOCS = 3;
/** Two weeks, wide enough to catch a whitelisted channel's last episode cycle. */
const CHANNEL_LOOKBACK_HOURS = 336;

function budgetMs(): number {
  const parsed = Number.parseInt(process.env.ANALYSIS_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
}

/** Master switch. Off means no news fetch and no LLM call at all. */
function pipelineEnabled(): boolean {
  return process.env.ANALYSIS_CHAIN_ENABLED !== "0";
}

export interface AnalysisResult {
  entry: CachedAnalysis;
  /** How the caller obtained it, for cron reporting and response headers. */
  cache: "hit" | "stale" | "miss";
}

function contextSourcesToDocs(sources: ContextSource[]): NewsDoc[] {
  const tierToSource: Record<ContextSource["tier"], NewsSourceId> = {
    news: "google-news",
    web: "serper",
    youtube: "serper",
    signal: "google-news",
  };
  return sources.map((source) => ({
    title: source.title,
    publisher: source.publisher,
    link: source.url,
    publishedAt: source.publishedAt,
    snippet: source.snippet,
    source: tierToSource[source.tier],
    publisherKind: source.tier === "news" ? "trusted" : "unknown",
  }));
}

function buildTemplate(options: {
  entity: RankingEntity;
  market: RankingsPayload;
  related?: RankingEntity[];
  editionDate: string;
  override?: TodayAnalysisOverride;
  facts?: string[];
}): TodayAnalysisArticle {
  return composeTodayAnalysis({
    entity: options.entity,
    market: options.market,
    related: options.related,
    editionDate: options.editionDate,
    override: options.override,
    facts: options.facts,
  });
}

/**
 * Runs retrieval plus the three chaining steps and folds the result into the
 * deterministic column. Every failure mode (no key, thin coverage, timeout,
 * failed audit) returns the template article instead, so a detail page always
 * renders something compliant.
 */
async function generate(options: {
  entity: RankingEntity;
  market: RankingsPayload;
  related?: RankingEntity[];
  editionDate: string;
}): Promise<CachedAnalysis> {
  const { entity, market, related, editionDate } = options;
  const keyword = entity.name;
  const logger = analysisLogger(keyword);
  const deadline = Date.now() + budgetMs();
  const remaining = () => Math.max(0, deadline - Date.now());

  logger.step("start", { slug: entity.slug, edition: editionDate });

  let provenance: AnalysisProvenance = {
    kind: "template",
    newsDocs: 0,
    publishers: [],
    facts: [],
    buildMs: 0,
  };
  let override: TodayAnalysisOverride | undefined;
  let brief: Awaited<ReturnType<typeof summarizeFacts>> = null;

  if (!pipelineEnabled()) {
    logger.step("pipeline", { skipped: "ANALYSIS_CHAIN_ENABLED=0" });
  } else {
    // Retrieval runs even without an API key so the RAG stage stays observable
    // and testable on its own; only the LLM steps below need credentials.
    // Whitelisted channels are covered in bursts around an episode rather than
    // daily, so the breaking-news window leaves them with nothing to cite even
    // though coverage exists. Their columns are evergreen, so a wider window is
    // both available and appropriate.
    const channel = findTrafficChannelByName(keyword);
    const articleContext = await collectArticleContext(keyword, {
      entity,
      related,
      lookbackHours: channel ? CHANNEL_LOOKBACK_HOURS : undefined,
    });
    logger.step("context", {
      score: articleContext.score,
      signalFacts: articleContext.signalFacts.length,
      sources: articleContext.sources.length,
      providers: articleContext.providers.join(","),
      tiers: articleContext.sources.map((source) => source.tier).join(","),
      lookbackHours: articleContext.lookbackHours,
    });
    for (const fact of articleContext.signalFacts) {
      logger.detail(`· [signal:${fact.kind}] ${fact.text.slice(0, 100)}`);
    }
    for (const source of articleContext.sources) {
      logger.detail(`· [${source.tier}:${source.publisher ?? "?"}] ${source.title}`);
      if (source.snippet) logger.detail(`    ${source.snippet.slice(0, 120)}`);
    }

    const retrievalDocs = contextSourcesToDocs(articleContext.sources);
    provenance = { ...provenance, newsDocs: retrievalDocs.length };

    if (!llmConfigured()) {
      logger.step("chain", { skipped: "OPENAI_API_KEY missing" });
    } else if (!canGenerateContext(articleContext)) {
      logger.step("chain", {
        skipped: "thin context",
        score: articleContext.score,
        sources: articleContext.sources.length,
        need: "score>=6 and sources>=1",
      });
    } else {
      brief = await summarizeFacts({
        keyword,
        docs: retrievalDocs,
        signalFacts: articleContext.signalFacts.map((fact) => fact.text),
        logger,
        timeoutMs: remaining(),
      });

      if (brief && remaining() > 5_000) {
        const issueKeyword = issueKeywordFromEntity(
          entity,
          (related ?? []).map((item) => ({ name: item.name, slug: item.slug })),
        );
        const { focus, supportKw } = pickIssueKeywords(issueKeyword);
        const useBriefingPrompt = usesBriefingAnalysisPrompt(entity.slug);
        const promptChannel = analysisPromptChannel(entity.slug);

        const draft = await draftColumn({
          keyword,
          focus,
          supportKw,
          label: TYPE_LABEL[entity.type] || entity.type,
          brief,
          logger,
          timeoutMs: remaining(),
          channel: promptChannel,
          useBriefingPrompt,
        });

        if (draft) {
          const edited =
            remaining() > 5_000
              ? await reviewColumn({ draft, brief, logger, timeoutMs: remaining() })
              : draft;
          override = {
            title: edited.title,
            excerpt: edited.excerpt,
            sections: edited.sections,
          };
          provenance = {
            kind: "chain",
            newsDocs: retrievalDocs.length,
            publishers: brief.publishers.slice(0, 6),
            facts: brief.facts,
            model: llmModel(),
            buildMs: 0,
          };
        }
      }
    }
  }

  let article = buildTemplate({ entity, market, related, editionDate, override, facts: brief?.facts });

  if (override) {
    const report = evaluateTodayAnalysis(article);
    if (!report.ok) {
      // The chain body could not be brought into spec, so publish the
      // deterministic column rather than an article that fails the audit.
      logger.warn("audit", { rejected: "chain body", failures: report.failures.slice(0, 4) });
      article = buildTemplate({ entity, market, related, editionDate, facts: brief?.facts });
      provenance = { ...provenance, kind: "template" };
    } else {
      logger.step("audit", { ok: true, chars: report.characterCount });
    }
  }

  // Distribution assets ride along only when the column is news-grounded; a
  // template column has no reported facts to summarise into a 15 second short.
  let pump: TrafficPump | undefined;
  if (brief && provenance.kind === "chain" && remaining() > 5_000) {
    pump =
      (await buildTrafficPump({
        keyword,
        articleTitle: article.title,
        articleUrl: `${SITE.url}${rankingPath(entity.slug)}`,
        brief,
        logger,
        timeoutMs: remaining(),
      })) ?? undefined;
  }

  const generatedAt = new Date();
  const entry: CachedAnalysis = {
    slug: entity.slug,
    keyword,
    editionDate,
    generatedAt: generatedAt.toISOString(),
    expiresAt: new Date(generatedAt.getTime() + analysisTtlHours() * 3600_000).toISOString(),
    article,
    provenance: { ...provenance, buildMs: logger.elapsed() },
    pump,
  };

  const saved = await writeAnalysis(entry);
  logger.step("cache", {
    stored: true,
    file: saved.file,
    supabase: saved.supabase,
    ttlHours: analysisTtlHours(),
    kind: entry.provenance.kind,
    pump: Boolean(entry.pump),
    totalMs: logger.elapsed(),
  });

  return entry;
}

/**
 * De-duplicates concurrent generation for the same slug. Without this, a page
 * view and a cron pass landing together would each pay for the full chain.
 */
const inFlight = new Map<string, Promise<CachedAnalysis>>();

function generateOnce(options: {
  entity: RankingEntity;
  market: RankingsPayload;
  related?: RankingEntity[];
  editionDate: string;
}): Promise<CachedAnalysis> {
  const key = `${options.entity.slug}:${options.editionDate}`;
  const running = inFlight.get(key);
  if (running) return running;

  const task = generate(options).finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}

/**
 * On-demand entry point for detail pages. A fresh entry is served from cache; a
 * stale one is served immediately while a refresh runs in the background, so a
 * visitor never waits on the chain for content that already exists.
 */
export async function getOrCreateAnalysis(options: {
  entity: RankingEntity;
  market: RankingsPayload;
  related?: RankingEntity[];
  editionDate?: string;
  force?: boolean;
}): Promise<AnalysisResult> {
  const editionDate = options.editionDate ?? kstDateString();
  const cached = options.force ? undefined : await readAnalysis(options.entity.slug);

  if (cached && cached.editionDate === editionDate && !isExpired(cached)) {
    return { entry: cached, cache: "hit" };
  }

  if (cached) {
    void generateOnce({ ...options, editionDate }).catch(() => undefined);
    return { entry: cached, cache: "stale" };
  }

  // Never block navigation on a cold slug — warm the chain in the background and
  // let the page render from measured data until a grounded column is cached.
  void generateOnce({ ...options, editionDate }).catch(() => undefined);
  const article = buildTemplate({
    entity: options.entity,
    market: options.market,
    related: options.related,
    editionDate,
  });
  const generatedAt = new Date();
  return {
    entry: {
      slug: options.entity.slug,
      keyword: options.entity.name,
      editionDate,
      generatedAt: generatedAt.toISOString(),
      expiresAt: generatedAt.toISOString(),
      article,
      provenance: { kind: "template", newsDocs: 0, publishers: [], facts: [], buildMs: 0 },
    },
    cache: "miss",
  };
}

/** Cron entry point: always rebuilds and waits for the result. */
export async function refreshAnalysis(options: {
  entity: RankingEntity;
  market: RankingsPayload;
  related?: RankingEntity[];
  editionDate?: string;
}): Promise<CachedAnalysis> {
  return generateOnce({ ...options, editionDate: options.editionDate ?? kstDateString() });
}
