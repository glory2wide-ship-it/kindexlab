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

  // Public login API + analytics beacon.
  if (
    pathname === "/api/admin/login" ||
    pathname === "/api/admin/logout" ||
    pathname.startsWith("/api/analytics/")
  ) {
    return NextResponse.next();
  }

  // Password form lives on /admin — allow the document through; the page gates UI.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const provided = request.nextUrl.searchParams.get("secret");
    if (provided && secretMatches(provided)) {
      const url = request.nextUrl.clone();
      url.searchParams.delete("secret");
      const response = NextResponse.redirect(url);
      response.headers.set("Set-Cookie", cookieHeader(provided));
      return response;
    }
    return NextResponse.next();
  }

  // Protect admin JSON APIs.
  if (pathname.startsWith("/api/admin/")) {
    if (isAuthorized(request)) return NextResponse.next();
    if (!dashboardSecret() && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "ADMIN_DASHBOARD_SECRET missing" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*", "/api/analytics/:path*"],
};
