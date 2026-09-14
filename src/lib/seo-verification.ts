import type { Metadata } from "next";

/**
 * Search Console / 서치어드바이저 ownership tokens.
 * Values appear in public HTML once set — store in Vercel env, not in git.
 *
 * Google Search Console → HTML tag → content="…"（google-site-verification）
 * 네이버 서치어드바이저 → HTML 태그 → content="…"（naver-site-verification）
 */
export function siteVerificationMetadata(): Metadata["verification"] | undefined {
  const google = (
    process.env.GOOGLE_SITE_VERIFICATION ??
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ??
    ""
  ).trim();
  const naver = (
    process.env.NAVER_SITE_VERIFICATION ??
    process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION ??
    ""
  ).trim();

  if (!google && !naver) return undefined;

  return {
    ...(google ? { google } : {}),
    ...(naver
      ? {
          other: {
            "naver-site-verification": naver,
          },
        }
      : {}),
  };
}
