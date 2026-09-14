import { NextResponse } from "next/server";
import { recordTrafficBeacon } from "@/lib/analytics/traffic";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|python-requests|curl|wget|headless/i;

export async function POST(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  if (BOT_UA.test(ua)) {
    return NextResponse.json({ ok: true, skipped: "bot" });
  }

  let body: {
    visitorId?: string;
    path?: string;
    title?: string;
    pageview?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const visitorId = body.visitorId?.trim();
  const pathName = body.path?.trim();
  if (!visitorId || !pathName) {
    return NextResponse.json({ error: "visitorId and path required" }, { status: 400 });
  }

  await recordTrafficBeacon({
    visitorId,
    path: pathName,
    title: body.title,
    pageview: body.pageview !== false,
  });

  return NextResponse.json({ ok: true });
}
