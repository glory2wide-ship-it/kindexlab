import { fetchHeadlineRanking, type HeadlineChannel } from "@/lib/politics/headlines";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseChannel(raw: string | null): HeadlineChannel {
  if (raw === "entertainment") return "entertainment";
  if (raw === "economy") return "economy";
  if (raw === "culture") return "culture";
  return "politics";
}

export async function GET(request: Request) {
  const channel = parseChannel(new URL(request.url).searchParams.get("channel"));
  const payload = await fetchHeadlineRanking(channel);
  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=180, stale-while-revalidate=900",
    },
  });
}
