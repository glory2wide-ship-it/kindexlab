import { getPresidentialPolls } from "@/lib/politics/polls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const payload = await getPresidentialPolls();
  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
    },
  });
}
