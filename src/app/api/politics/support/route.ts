import { NextResponse } from "next/server";
import {
  getSupportChartPayload,
  type SupportBar,
  type SupportKind,
} from "@/lib/politics/support-series";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseKind(raw: string | null): SupportKind {
  return raw === "politician" ? "politician" : "party";
}

function parseBar(raw: string | null): SupportBar {
  if (raw === "1d" || raw === "1mo") return raw;
  return "1w";
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const payload = await getSupportChartPayload({
    kind: parseKind(params.get("kind")),
    subject: params.get("subject")?.trim() || undefined,
    bar: parseBar(params.get("bar")),
  });
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
    },
  });
}
