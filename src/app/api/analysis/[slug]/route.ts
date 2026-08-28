import { composeTodayAnalysisForSlug } from "@/lib/editorial/today-analysis";
import { getRankings } from "@/lib/api";
import { decodeRouteSlug } from "@/lib/slugs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await params;
  const slug = decodeRouteSlug(raw);
  const market = await getRankings();
  const article = composeTodayAnalysisForSlug(slug, market);
  if (!article) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(
    { article },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
