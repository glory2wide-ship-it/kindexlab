/**
 * Guardrail: the landing "오늘의 트렌드 브리핑" rail must show today's live
 * briefings, not premium columns from generated.json (which lag by edition).
 *
 * Run: npm run landing:check
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagePath = path.join(root, "src/app/page.tsx");
const source = readFileSync(pagePath, "utf8");

const failures = [];

if (!source.includes("loadFeaturedBriefings")) {
  failures.push("page.tsx must load TODAY'S DESK via loadFeaturedBriefings");
}
if (source.includes("loadFeaturedColumns")) {
  failures.push("page.tsx must not use loadFeaturedColumns for TODAY'S DESK");
}
if (source.includes("PremiumColumnRail")) {
  failures.push("page.tsx must not render PremiumColumnRail for TODAY'S DESK");
}
if (!source.includes("BriefingRail")) {
  failures.push("page.tsx must render BriefingRail for TODAY'S DESK");
}

if (failures.length) {
  console.error("Landing desk check failed:\n" + failures.map((line) => `  - ${line}`).join("\n"));
  process.exit(1);
}

console.log("Landing desk check passed.");
