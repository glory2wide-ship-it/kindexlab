/**
 * Guardrail: every post channel slug must resolve to live board/rankings briefings.
 *
 * Run: npm run briefing:check
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storeSource = readFileSync(path.join(root, "src/lib/briefing/store.ts"), "utf8");
const composeSource = readFileSync(path.join(root, "src/lib/briefing/compose.ts"), "utf8");

const failures = [];

const channels = ["entertainment", "politics", "economy", "culture", "travel"];
const slug = "2026-09-02-travel-daily";
const match = slug.match(/^\d{4}-\d{2}-\d{2}-([a-z]+)-/);
const parsed = channels.includes(match?.[1] ?? "") ? match[1] : undefined;
if (parsed !== "travel") {
  failures.push(`slug parser must resolve travel daily slugs (got ${parsed ?? "undefined"})`);
}

if (!storeSource.includes("isPostChannel")) {
  failures.push("store.ts must parse briefing slugs with isPostChannel()");
}

if (!composeSource.includes("channelUsesBoardBriefing")) {
  failures.push("composeEdition must skip board-briefing channels in the daily persist job");
}

if (failures.length) {
  console.error("Briefing routing check failed:\n" + failures.map((line) => `  - ${line}`).join("\n"));
  process.exit(1);
}

console.log("Briefing routing check passed.");
