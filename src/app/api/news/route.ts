import { getMarket, isCountryCode } from "@/lib/market/config";
import { retrieveNewsForKeyword } from "@/lib/news/retrieve";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 20;

function toInt(raw: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const keyword = params.get("keyword")?.trim();
  if (!keyword) {
    return Response.json({ error: "keyword is required" }, { status: 400 });
  }

  // ?country=US previews another market without redeploying.
  const requested = (params.get("country") ?? "").toUpperCase();
  const market = isCountryCode(requested) ? getMarket(requested) : undefined;

  const retrieval = await retrieveNewsForKeyword(keyword, {
    market,
    limit: toInt(params.get("limit"), 8, MAX_LIMIT),
    lookbackHours: toInt(params.get("hours"), 72, 24 * 14),
    trustedOnly: params.get("trustedOnly") !== "0",
  });

  return Response.json(retrieval, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
  });
}
