import type { Metadata } from "next";

/**
 * Search Console / 서치어드바이저 ownership tokens (public HTML meta).
 * Env overrides win when set on Vercel; otherwise the committed defaults apply.
 *
 * Google Search Console → HTML tag → content="…"
 * 네이버 서치어드바이저 → HTML 태그 → content="…"
 */
const DEFAULT_GOOGLE_SITE_VERIFICATION =
  "je2eU2uOaCTdnOgcRvGMP-X40LYBbT1yit6_QaiFsa0";
const DEFAULT_NAVER_SITE_VERIFICATION =
  "7ebb310098d482149736de711ea6ec40f2b71b74";

export function siteVerificationMetadata(): Metadata["verification"] | undefined {
  const google = (
    process.env.GOOGLE_SITE_VERIFICATION ??
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ??
    DEFAULT_GOOGLE_SITE_VERIFICATION
  ).trim();
  const naver = (
    process.env.NAVER_SITE_VERIFICATION ??
    process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION ??
    DEFAULT_NAVER_SITE_VERIFICATION
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
