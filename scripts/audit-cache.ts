import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CachedAnalysis } from "@/lib/analysis/store";
import { BANNED, countKeyword, MARKET_TAPE } from "@/lib/editorial/rules";
import {
  analysisPlainText,
  ANALYSIS_MAX,
  ANALYSIS_MIN,
} from "@/lib/editorial/today-analysis";

/**
 * Reports quality metrics for every cached column. Emits counts only, never the
 * article text, so it can run in CI without dumping content into logs.
 */
const CONNECTIVE_END = /(으며|하고|지만|면서|때문에|이며|으로써)\s*[.!?]/;
const COMMA_DOT = /,\s*\./;

function bodyOf(entry: CachedAnalysis): string {
  return entry.article.sections.flatMap((section) => section.paragraphs).join(" ");
}

async function main() {
  const file = path.join(process.cwd(), "src", "data", "analysis", "cache.json");
  const parsed = JSON.parse(await readFile(file, "utf8")) as { entries: CachedAnalysis[] };
  const entries = parsed.entries;

  let failures = 0;
  const check = (label: string, bad: CachedAnalysis[]) => {
    failures += bad.length;
    console.log(`${bad.length === 0 ? "ok  " : "FAIL"} ${label}: ${bad.length}`);
    for (const entry of bad.slice(0, 5)) console.log(`       - ${entry.slug}`);
  };

  const chain = entries.filter((entry) => entry.provenance.kind === "chain");
  const withNews = entries.filter((entry) => entry.provenance.newsDocs >= 3);

  console.log(`entries=${entries.length} chain=${chain.length} template=${entries.length - chain.length}`);
  console.log(
    `grounded(newsDocs>=3)=${withNews.length} of which chained=${withNews.filter((e) => e.provenance.kind === "chain").length}`,
  );
  console.log("");

  check("banned phrases in body", entries.filter((entry) => BANNED.test(bodyOf(entry))));
  check("market tape leaked into body", entries.filter((entry) => MARKET_TAPE.test(bodyOf(entry))));
  check("comma-dot artifact", entries.filter((entry) => COMMA_DOT.test(bodyOf(entry))));
  check("connective sentence ending", entries.filter((entry) => CONNECTIVE_END.test(bodyOf(entry))));
  // A stale entry written before the char migration has no characterCount, and
  // an undefined comparison is false on both sides, so it would pass the band
  // check without ever being measured. Flag it as its own failure.
  check(
    "stale entry missing characterCount",
    entries.filter((entry) => !Number.isFinite(entry.article.characterCount)),
  );
  check(
    `자수 out of ${ANALYSIS_MIN}-${ANALYSIS_MAX} band`,
    entries.filter(
      (entry) =>
        Number.isFinite(entry.article.characterCount) &&
        (entry.article.characterCount < ANALYSIS_MIN ||
          entry.article.characterCount > ANALYSIS_MAX + 60),
    ),
  );
  // Counted over the whole document, matching what evaluateTodayAnalysis gates on.
  check(
    "focus keyword used under 5 times",
    entries.filter(
      (entry) => countKeyword(analysisPlainText(entry.article), entry.article.focusKeyword) < 5,
    ),
  );
  check(
    "support keyword used under 5 times",
    entries.filter(
      (entry) => countKeyword(analysisPlainText(entry.article), entry.article.supportKeyword) < 5,
    ),
  );
  check("missing markdown table", entries.filter((entry) => !entry.article.table));
  check("fewer than 3 FAQ items", entries.filter((entry) => (entry.article.faq?.length ?? 0) < 3));
  check("chain column missing traffic pump", chain.filter((entry) => !entry.pump));
  check(
    "shorts script outside 4-6 lines",
    chain.filter((entry) => entry.pump && (entry.pump.shortsScript.length < 4 || entry.pump.shortsScript.length > 6)),
  );
  check(
    "shorts line over 45 chars",
    chain.filter((entry) => entry.pump?.shortsScript.some((line) => line.length > 45)),
  );
  check(
    "pump mentions market tape",
    chain.filter(
      (entry) =>
        entry.pump && MARKET_TAPE.test([entry.pump.pinnedComment, ...entry.pump.shortsScript].join(" ")),
    ),
  );

  console.log(`\n${failures === 0 ? "PASS" : `FAIL (${failures} issues)`}`);
  if (failures > 0) process.exitCode = 1;
}

main();
