import { analysisPromptChannel } from "@/lib/analysis/briefing-boards";
import { analysisLlmConfigured, BRIEFING_LLM } from "@/lib/analysis/chain/llm";
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
import {
  composePremiumTodayAnalysis,
  composeTodayAnalysis,
  type TodayAnalysisArticle,
} from "@/lib/editorial/today-analysis";
import { TYPE_LABEL } from "@/lib/format";
import { channelFromEntityType } from "@/lib/posts/channels";
import { generatePremiumArticle } from "@/lib/premium/generate";
import { rankingPath } from "@/lib/slugs";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

/**
 * Align with briefing single-pass (RAG + one Gemini call + optional length expand).
 * Override via ANALYSIS_TIMEOUT_MS.
 */
function budgetMs(): number {
  const parsed = Number.parseInt(process.env.ANALYSIS_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 150_000;
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
}): TodayAnalysisArticle {
  return composeTodayAnalysis({
    entity: options.entity,
    market: options.market,
    related: options.related,
    editionDate: options.editionDate,
  });
}

/**
 * Runs the same Gemini single-pass as 일일 브리핑 / 심층분석
 * (`STATIC_SYSTEM_PROMPT` + `buildSinglePassUserPrompt`), then maps the
 * premium article into the Today's Analysis shape. Failures fall back to the
 * deterministic template so detail pages always render.
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

  logger.step("start", { slug: entity.slug, edition: editionDate, pipeline: "briefing-single-pass" });

  let provenance: AnalysisProvenance = {
    kind: "template",
    newsDocs: 0,
    publishers: [],
    facts: [],
    buildMs: 0,
  };
  let article = buildTemplate({ entity, market, related, editionDate });

  if (!pipelineEnabled()) {
    logger.step("pipeline", { skipped: "ANALYSIS_CHAIN_ENABLED=0" });
  } else if (!analysisLlmConfigured()) {
    logger.step("chain", { skipped: "GEMINI_API_KEY missing" });
  } else {
    const promptChannel =
      analysisPromptChannel(entity.slug) ?? channelFromEntityType(entity.type);
    const relatedNames = (related ?? [])
      .map((item) => item.name)
      .filter((name) => name && name !== keyword)
      .slice(0, 6);

    const result = await generatePremiumArticle({
      keyword,
      slug: entity.slug,
      category: TYPE_LABEL[entity.type] || entity.type,
      channel: promptChannel,
      related: relatedNames,
      entity,
      relatedEntities: related,
      preferredInternalLink: related?.[0]
        ? {
            href: rankingPath(related[0].slug),
            label: `${related[0].name} 이슈가 지금 화제인 이유`,
          }
        : null,
      logger,
      timeoutMs: budgetMs(),
      editionDate,
      briefing: true,
      // Cost control: no Gemini length-expand for Today's Analysis.
      skipLengthExpandLlm: true,
    });

    if (result.ok) {
      article = composePremiumTodayAnalysis({
        entity,
        market,
        related,
        editionDate,
        premium: result.article,
      });
      provenance = {
        kind: "chain",
        newsDocs: result.article.sources.length,
        publishers: [
          ...new Set(result.article.sources.map((source) => source.publisher).filter(Boolean)),
        ].slice(0, 6),
        facts: result.article.sections
          .flatMap((section) => section.paragraphs)
          .slice(0, 3),
        model: result.article.model || `${BRIEFING_LLM.draftModel()}+${BRIEFING_LLM.editorModel()}`,
        buildMs: 0,
      };
      logger.step("audit", {
        ok: true,
        chars: article.characterCount,
        pipeline: "briefing-single-pass",
      });
    } else {
      logger.warn("chain", {
        skipped: result.reason,
        detail: result.detail ?? null,
      });
    }
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
  };

  const saved = await writeAnalysis(entry);
  logger.step("cache", {
    stored: true,
    file: saved.file,
    supabase: saved.supabase,
    ttlHours: analysisTtlHours(),
    kind: entry.provenance.kind,
    pump: false,
    totalMs: logger.elapsed(),
  });

  return entry;
}

/**
 * De-duplicates concurrent generation for the same slug. Without this, a page
 * view and a cron pass landing together would each pay for a full Gemini call.
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
 * On-demand entry point for detail pages.
 *
 * - First visitor click on a cold slug queues Gemini generation (miss → template,
 *   background refresh).
 * - Cached columns stay valid for ANALYSIS_TTL_HOURS (default 72h / 3 days).
 * - After expiry, the stale column is served while a refresh runs in the background.
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

  // Same name within the 3-day TTL: reuse regardless of KST calendar day.
  if (cached && !isExpired(cached)) {
    return { entry: cached, cache: "hit" };
  }

  // Manual / Gemini imports keep a long TTL and must not be overwritten by the
  // on-demand chain when a visitor opens the detail page.
  if (cached?.provenance.model?.startsWith("import:")) {
    return { entry: cached, cache: isExpired(cached) ? "stale" : "hit" };
  }

  if (cached) {
    void generateOnce({ ...options, editionDate }).catch(() => undefined);
    return { entry: cached, cache: "stale" };
  }

  // First click on a new heatmap name — queue generation, show template meanwhile.
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
