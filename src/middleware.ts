import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  adminCookieHeader,
  adminDashboardSecret,
  isAdminAuthorized,
  secretMatches,
} from "@/lib/ops/admin-auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the login bounce: /admin?secret=… must reach the page to set the cookie.
  const providedSecret = request.nextUrl.searchParams.get("secret");
  if (pathname === "/admin" && providedSecret && secretMatches(providedSecret)) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("secret");
    const response = NextResponse.redirect(url);
    response.headers.set("Set-Cookie", adminCookieHeader(providedSecret));
    return response;
  }

  if (isAdminAuthorized(request)) {
    return NextResponse.next();
  }

  // No secret configured in production — hard closed.
  if (!adminDashboardSecret() && process.env.NODE_ENV === "production") {
    return new NextResponse("Admin dashboard is locked (ADMIN_DASHBOARD_SECRET missing).", {
      status: 503,
    });
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return new NextResponse(
    [
      "<!doctype html><html lang='ko'><head><meta charset='utf-8'/><title>Admin</title></head><body>",
      "<main style='font-family:ui-sans-serif,system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5'>",
      "<h1 style='font-size:1.25rem'>관리자 전용</h1>",
      "<p>이 페이지는 일반 방문자가 볼 수 없습니다. 북마크용 URL:</p>",
      "<code style='display:block;padding:0.75rem;background:#f4f4f5;border-radius:0.5rem'>/admin?secret=YOUR_SECRET</code>",
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
