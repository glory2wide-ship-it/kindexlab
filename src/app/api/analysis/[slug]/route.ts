import { getOrCreateAnalysis } from "@/lib/analysis/pipeline";
import { isGeminiAnalysis } from "@/lib/analysis/quality";
import { getRankings } from "@/lib/api";
import { resolveAnalysisEntity } from "@/lib/editorial/today-analysis";
import { decodeRouteSlug } from "@/lib/slugs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await params;
  const slug = decodeRouteSlug(raw);
  const market = await getRankings();
  const resolved = resolveAnalysisEntity(slug, market);
  if (!resolved) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { entry, cache } = await getOrCreateAnalysis({
    entity: resolved.entity,
    market,
    related: resolved.related,
    force: new URL(request.url).searchParams.get("force") === "1",
  });

  const grounded = isGeminiAnalysis(entry);

  return Response.json(
    {
      article: grounded && entry ? entry.article : null,
      provenance: grounded && entry
        ? entry.provenance
        : { kind: "pending", newsDocs: 0, publishers: [], facts: [], buildMs: 0 },
      pump: grounded && entry ? (entry.pump ?? null) : null,
      generatedAt: grounded && entry ? entry.generatedAt : null,
      expiresAt: grounded && entry ? entry.expiresAt : null,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "X-Analysis-Cache": cache,
        "X-Analysis-Source": grounded && entry ? entry.provenance.kind : "pending",
      },
    },
  );
}
