import { fetchPoliticsHeadlineRanking } from "@/lib/politics/headlines";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const payload = await fetchPoliticsHeadlineRanking();
  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=180, stale-while-revalidate=900",
    },
  });
}
