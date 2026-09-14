#!/usr/bin/env node
/**
 * Pre-AdSense / Search Console readiness checks for KinDex.
 *
 *   npm run seo:check
 *   SEO_BASE_URL=https://www.kindexlab.com npm run seo:check
 */
function resolveBase() {
  const explicit = (process.env.SEO_BASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (/^https?:\/\//i.test(site) && !/localhost|127\.0\.0\.1/i.test(site)) {
    return site.replace(/\/+$/, "");
  }
  return "https://www.kindexlab.com";
}

const base = resolveBase();

const REQUIRED = [
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/terms",
  "/privacy",
  "/contact",
  "/disclaimer",
  "/entertainment",
  "/politics",
  "/economy",
  "/culture",
  "/travel",
];

const EMPTY_MARKERS = ["데이터가 없습니다", "순위 데이터가 없습니다", "집계 중", "no items"];

async function fetchOk(path) {
  const url = `${base}${path}`;
  const res = await fetch(url, { redirect: "follow" });
  const text = await res.text();
  const textLen = text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
  const emptyHits = EMPTY_MARKERS.filter((m) => text.includes(m));
  return {
    path,
    status: res.status,
    bytes: text.length,
    textLen,
    emptyHits,
    hasGoogleVerify: /google-site-verification/i.test(text),
    hasNaverVerify: /naver-site-verification/i.test(text),
  };
}

async function main() {
  console.log(`SEO base: ${base}\n`);
  const rows = [];
  for (const path of REQUIRED) {
    try {
      rows.push(await fetchOk(path));
    } catch (error) {
      rows.push({
        path,
        status: 0,
        bytes: 0,
        textLen: 0,
        emptyHits: [String(error)],
        hasGoogleVerify: false,
        hasNaverVerify: false,
      });
    }
  }

  let failed = false;
  for (const row of rows) {
    const ok = row.status === 200 && row.textLen > 80 && row.emptyHits.length === 0;
    if (!ok) failed = true;
    const mark = ok ? "OK" : "FAIL";
    console.log(
      `${mark}  ${row.status}  ${row.path}  text=${row.textLen}` +
        (row.emptyHits.length ? `  markers=${row.emptyHits.join("|")}` : ""),
    );
  }

  const home = rows.find((row) => row.path === "/");
  console.log("\nOwnership meta (home HTML):");
  console.log(`  google-site-verification: ${home?.hasGoogleVerify ? "present" : "missing (set GOOGLE_SITE_VERIFICATION)"}`);
  console.log(`  naver-site-verification:  ${home?.hasNaverVerify ? "present" : "missing (set NAVER_SITE_VERIFICATION)"}`);

  if (failed) {
    console.error("\nSEO readiness check failed.");
    process.exit(1);
  }
  console.log("\nSEO readiness check passed (pages + sitemap + robots).");
  if (!home?.hasGoogleVerify || !home?.hasNaverVerify) {
    console.log("Next: add Search Console / 서치어드바이저 verification env vars, redeploy, then submit sitemap.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
