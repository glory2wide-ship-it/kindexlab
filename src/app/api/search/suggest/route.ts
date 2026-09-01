import { NextResponse } from "next/server";
import { suggestSearchTerms } from "@/lib/search/suggest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const suggestions = await suggestSearchTerms(q);
  return NextResponse.json({ suggestions });
}
