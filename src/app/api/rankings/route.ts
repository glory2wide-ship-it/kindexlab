import { getRankings } from "@/lib/api";

/** Compatibility alias for /api/trends. Prefer /api/trends for new clients. */
export async function GET() {
  const payload = await getRankings();
  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
