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
import { retrieveNewsForKeyword } from "@/lib/news/retrieve";
import { SITE } from "@/lib/site";
import { rankingPath } from "@/lib/slugs";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

/** Below this many usable articles the chain is skipped: too little to ground. */
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

function buildTemplate(options: {
  entity: RankingEntity;
  market: RankingsPayload;
  related?: RankingEntity[];
  editionDate: string;
  override?: TodayAnalysisOverride;
}): TodayAnalysisArticle {
  return composeTodayAnalysis({
    entity: options.entity,
    market: options.market,
    related: options.related,
    editionDate: options.editionDate,
    override: options.override,
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
    const retrieval = await retrieveNewsForKeyword(keyword, {
      limit: 8,
      lookbackHours: channel ? CHANNEL_LOOKBACK_HOURS : undefined,
    });
    logger.step("news", {
      country: retrieval.country,
      providers: retrieval.providers.join(","),
      aliases: retrieval.aliases.length > 1 ? retrieval.aliases.join("|") : undefined,
      fetched: retrieval.stats.fetched,
      kept: retrieval.stats.kept,
      trusted: retrieval.stats.keptTrusted,
    });
    for (const doc of retrieval.docs) {
      logger.detail(`· [${doc.publisher ?? "?"}] ${doc.title}`);
      if (doc.snippet) logger.detail(`    ${doc.snippet.slice(0, 120)}`);
    }
    for (const error of retrieval.errors) {
      logger.warn("news-source", { source: error.source, message: error.message });
    }

    provenance = { ...provenance, newsDocs: retrieval.docs.length };

    if (!llmConfigured()) {
      logger.step("chain", { skipped: "OPENAI_API_KEY missing" });
    } else if (retrieval.docs.length < MIN_DOCS) {
      logger.step("chain", { skipped: "thin coverage", docs: retrieval.docs.length, need: MIN_DOCS });
    } else {
      brief = await summarizeFacts({
        keyword,
        docs: retrieval.docs,
        logger,
        timeoutMs: remaining(),
      });

      if (brief && remaining() > 5_000) {
        const issueKeyword = issueKeywordFromEntity(
          entity,
          (related ?? []).map((item) => ({ name: item.name, slug: item.slug })),
        );
        const { focus, supportKw } = pickIssueKeywords(issueKeyword);

        const draft = await draftColumn({
          keyword,
          focus,
          supportKw,
          label: TYPE_LABEL[entity.type] || entity.type,
          brief,
          logger,
          timeoutMs: remaining(),
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
            newsDocs: retrieval.docs.length,
            publishers: brief.publishers.slice(0, 6),
            facts: brief.facts,
            model: llmModel(),
            buildMs: 0,
          };
        }
      }
    }
  }

  let article = buildTemplate({ entity, market, related, editionDate, override });

  if (override) {
    const report = evaluateTodayAnalysis(article);
    if (!report.ok) {
      // The chain body could not be brought into spec, so publish the
      // deterministic column rather than an article that fails the audit.
      logger.warn("audit", { rejected: "chain body", failures: report.failures.slice(0, 4) });
      article = buildTemplate({ entity, market, related, editionDate });
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

  const entry = await generateOnce({ ...options, editionDate });
  return { entry, cache: "miss" };
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
