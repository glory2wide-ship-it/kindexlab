import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/ops/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const response = NextResponse.json({ ok: true });
  response.headers.set(
    "Set-Cookie",
    `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
  return response;
}
