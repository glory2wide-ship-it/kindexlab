/**
 * Guardrail: landing must fill each category's 1~4 under
 * 종합 · 5분 · 성별 전체 · 연령 전체, and keep that contract in source.
 *
 * Run: npm run landing:check
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

const pagePath = path.join(root, "src/app/page.tsx");
const pageSource = readFileSync(pagePath, "utf8");

if (!pageSource.includes("loadFeaturedBriefings")) {
  failures.push("page.tsx must load TODAY'S DESK via loadFeaturedBriefings");
}
if (pageSource.includes("loadFeaturedColumns")) {
  failures.push("page.tsx must not use loadFeaturedColumns for TODAY'S DESK");
}
if (pageSource.includes("PremiumColumnRail")) {
  failures.push("page.tsx must not render PremiumColumnRail for TODAY'S DESK");
}
if (!pageSource.includes("BriefingRail")) {
  failures.push("page.tsx must render BriefingRail for TODAY'S DESK");
}

const constants = readFileSync(path.join(root, "src/lib/boards/landing-constants.ts"), "utf8");
if (!/export const LANDING_PER_CHANNEL_TOP = 4/.test(constants)) {
  failures.push("LANDING_PER_CHANNEL_TOP must stay 4 (methodology: category 1~4)");
}
if (!/export const DESK_TOP_N = LANDING_PER_CHANNEL_TOP/.test(constants)) {
  failures.push(
    "DESK_TOP_N must equal LANDING_PER_CHANNEL_TOP so landing desk cards show ranks 1~4",
  );
}

const composite = readFileSync(path.join(root, "src/lib/boards/composite-desk.ts"), "utf8");
if (!composite.includes("withPreservedRank")) {
  failures.push(
    "composite-desk must preserve interleaved 1–20 ranks when merging Kospi quotes (desk tops must not clobber heatmap ranks)",
  );
}
if (!composite.includes("assertLandingMarketShape")) {
  failures.push("composite-desk must assert full per-category top-4 before writing slim cache");
}

const cache = readFileSync(path.join(root, "src/lib/boards/landing-unified-cache.ts"), "utf8");
if (!cache.includes("isCompleteLandingMarket")) {
  failures.push("landing-unified-cache must reject incomplete / rank-clobbered markets");
}
if (!/CACHE_VERSION = 3/.test(cache)) {
  failures.push("landing-unified CACHE_VERSION must be ≥3 after desk top-4 contract");
}

if (failures.length) {
  console.error("Landing desk check failed:\n" + failures.map((line) => `  - ${line}`).join("\n"));
  process.exit(1);
}

console.log("Landing desk check passed (briefing rail + category 1~4 contract).");
