import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { refreshAnalysis } from "@/lib/analysis/pipeline";
import { clearAnalysis } from "@/lib/analysis/store";
import { getRankings } from "@/lib/api";
import { cronAuthorized } from "@/lib/cron";
import { indexPath } from "@/lib/indices";
import { rankingPath } from "@/lib/slugs";
import type { RankingEntity, RankingsPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_BATCH = 6;
const MAX_BATCH = 20;

function toInt(raw: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

/**
 * Trend keywords worth pre-building: the busiest entities on the board. The
 * board is only the trigger here, no market figure reaches the column body.
 */
function pickTargets(market: RankingsPayload, limit: number, slug?: string): RankingEntity[] {
  if (slug) {
    const found = market.items.find((item) => item.slug === slug);
    return found ? [found] : [];
  }
  return [...market.items]
    .sort((a, b) => Math.abs(b.fluctuationRate) - Math.abs(a.fluctuationRate))
    .slice(0, limit);
}

async function handle(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const startedAt = Date.now();

  const cleared = params.get("reset") === "1" ? await clearAnalysis() : 0;

  const market = await getRankings();
  const targets = pickTargets(
    market,
    toInt(params.get("limit"), DEFAULT_BATCH, MAX_BATCH),
    params.get("slug") ?? undefined,
  );

  const results: {
    slug: string;
    keyword: string;
    kind: string;
    newsDocs: number;
    chars: number;
    buildMs: number;
  }[] = [];

  // Sequential on purpose: each keyword is one Gemini single-pass (+ optional
  // length expand), and parallel batches trip provider rate limits quickly.
  for (const entity of targets) {
    const related = market.items
      .filter((item) => item.id !== entity.id && item.type === entity.type)
      .slice(0, 6);
    try {
      const entry = await refreshAnalysis({ entity, market, related });
      results.push({
        slug: entry.slug,
        keyword: entry.keyword,
        kind: entry.provenance.kind,
        newsDocs: entry.provenance.newsDocs,
        chars: entry.article.characterCount,
        buildMs: entry.provenance.buildMs,
      });
      revalidatePath(rankingPath(entry.slug));
    } catch (error) {
      results.push({
        slug: entity.slug,
        keyword: entity.name,
        kind: "failed",
        newsDocs: 0,
        chars: 0,
        buildMs: 0,
      });
      console.warn(
        `[analysis:generate] ${entity.slug}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  for (const index of market.indices) revalidatePath(indexPath(index.id));

  return NextResponse.json({
    ok: true,
    cleared,
    generated: results.filter((item) => item.kind === "chain").length,
    chained: results.filter((item) => item.kind === "chain").length,
    failed: results.filter((item) => item.kind === "failed").length,
    totalMs: Date.now() - startedAt,
    results,
  });
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
