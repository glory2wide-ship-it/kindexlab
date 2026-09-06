import { getRankings } from "@/lib/api";
import { trendsRevalidateSec } from "@/lib/refresh";

/** Compatibility alias for /api/trends. Prefer /api/trends for new clients. */
export async function GET() {
  const payload = await getRankings();
  const maxAge = trendsRevalidateSec();
  return Response.json(payload, {
    headers: {
      "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
    },
  });
}
