/** HttpOnly cookie set after `/admin?secret=…` so the browser can reload without the query. */
export const ADMIN_COOKIE = "kindex_admin";

/** Prefer a dedicated secret; fall back to CRON_SECRET so one vault entry works. */
export function adminDashboardSecret(): string | null {
  const dedicated = process.env.ADMIN_DASHBOARD_SECRET?.trim();
  if (dedicated) return dedicated;
  const cron = process.env.CRON_SECRET?.trim();
  return cron || null;
}

/** Constant-time compare that works in Edge middleware (no node:crypto). */
function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let out = 0;
  for (let i = 0; i < left.length; i += 1) {
    out |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return out === 0;
}

export function secretMatches(candidate: string | null | undefined): boolean {
  const expected = adminDashboardSecret();
  if (!expected) {
    // Local/dev without secrets — same contract as cronAuthorized.
    return process.env.NODE_ENV !== "production";
  }
  if (!candidate) return false;
  return safeEqual(candidate, expected);
}

/** Bearer, `?secret=`, or admin cookie. */
export function isAdminAuthorized(request: Request): boolean {
  if (!adminDashboardSecret() && process.env.NODE_ENV !== "production") {
    return true;
  }
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (secretMatches(bearer)) return true;

  const url = new URL(request.url);
  if (secretMatches(url.searchParams.get("secret"))) return true;

  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  if (match && secretMatches(decodeURIComponent(match[1] ?? ""))) return true;

  return false;
}

export function adminCookieHeader(secret: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  // 30 days — owner machine bookmarking.
  return `${ADMIN_COOKIE}=${encodeURIComponent(secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}
