import { NextResponse } from "next/server";
import {
  adminCookieHeader,
  adminDashboardSecret,
  secretMatches,
} from "@/lib/ops/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let password = "";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { password?: string } | null;
    password = body?.password?.trim() ?? "";
  } else {
    const form = await request.formData().catch(() => null);
    password = String(form?.get("password") ?? "").trim();
  }

  const expected = adminDashboardSecret();
  if (!expected && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "ADMIN_DASHBOARD_SECRET 또는 CRON_SECRET 이 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  if (!secretMatches(password)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const token = expected ?? password;
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", adminCookieHeader(token));
  return response;
}
