import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Must read env in this file so Next/Vercel Edge bundles the vars into middleware. */
function dashboardSecret(): string | null {
  const dedicated = process.env.ADMIN_DASHBOARD_SECRET?.trim();
  if (dedicated) return dedicated;
  const cron = process.env.CRON_SECRET?.trim();
  return cron || null;
}

const ADMIN_COOKIE = "kindex_admin";

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let out = 0;
  for (let i = 0; i < left.length; i += 1) {
    out |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return out === 0;
}

function secretMatches(candidate: string | null | undefined): boolean {
  const expected = dashboardSecret();
  if (!expected) return process.env.NODE_ENV !== "production";
  if (!candidate) return false;
  return safeEqual(candidate, expected);
}

function isAuthorized(request: NextRequest): boolean {
  if (!dashboardSecret() && process.env.NODE_ENV !== "production") return true;

  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (secretMatches(bearer)) return true;

  if (secretMatches(request.nextUrl.searchParams.get("secret"))) return true;

  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  if (match && secretMatches(decodeURIComponent(match[1] ?? ""))) return true;

  return false;
}

function cookieHeader(secret: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_COOKIE}=${encodeURIComponent(secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const providedSecret = request.nextUrl.searchParams.get("secret");

  if (pathname === "/admin" && providedSecret && secretMatches(providedSecret)) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("secret");
    const response = NextResponse.redirect(url);
    response.headers.set("Set-Cookie", cookieHeader(providedSecret));
    return response;
  }

  if (isAuthorized(request)) {
    return NextResponse.next();
  }

  const bookmark = "https://www.kindexlab.com/admin?secret=YOUR_SECRET";

  if (!dashboardSecret() && process.env.NODE_ENV === "production") {
    return new NextResponse(
      [
        "<!doctype html><html lang='ko'><head><meta charset='utf-8'/><title>Admin</title></head><body>",
        "<main style='font-family:ui-sans-serif,system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5'>",
        "<h1 style='font-size:1.25rem'>관리자 URL은 준비됨</h1>",
        "<p>공개 주소: <a href='https://www.kindexlab.com/admin'>https://www.kindexlab.com/admin</a></p>",
        "<p>Vercel Production에 <code>ADMIN_DASHBOARD_SECRET</code> 또는 <code>CRON_SECRET</code>을 넣으면 바로 열립니다.</p>",
        `<code style='display:block;padding:0.75rem;background:#f4f4f5;border-radius:0.5rem;word-break:break-all'>${bookmark}</code>`,
        "</main></body></html>",
      ].join(""),
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return new NextResponse(
    [
      "<!doctype html><html lang='ko'><head><meta charset='utf-8'/><title>Admin</title></head><body>",
      "<main style='font-family:ui-sans-serif,system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5'>",
      "<h1 style='font-size:1.25rem'>관리자 전용</h1>",
      "<p>북마크용 웹 URL:</p>",
      `<code style='display:block;padding:0.75rem;background:#f4f4f5;border-radius:0.5rem;word-break:break-all'>${bookmark}</code>`,
      "<p style='color:#71717a;font-size:0.875rem'>비밀값은 Vercel의 <code>ADMIN_DASHBOARD_SECRET</code> 또는 <code>CRON_SECRET</code> 입니다.</p>",
      "</main></body></html>",
    ].join(""),
    {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/ops", "/api/admin/ops/:path*"],
};
