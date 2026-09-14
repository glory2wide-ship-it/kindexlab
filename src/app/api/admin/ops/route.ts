import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/ops/admin-auth";
import { buildAdminDashboard } from "@/lib/ops/admin-dashboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const editionDate = url.searchParams.get("date") ?? undefined;
  const payload = await buildAdminDashboard(editionDate || undefined);
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
