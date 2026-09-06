/**
 * Quality gate for the ranking boards. Reads the on-disk cache and checks the
 * contract each board must satisfy: full ranking, distinct demographic segments,
 * minimum body length, a ranking table, three FAQ entries and a shorts script.
 *
 *   npm run boards:audit
 */
import { AGE_SEGMENTS, GENDER_SEGMENTS } from "../src/lib/boards/demographics";
import { BOARDS } from "../src/lib/boards/registry";
import { listBoards } from "../src/lib/boards/store";
import type { BoardRankEntry, CachedBoard } from "../src/lib/boards/types";

const MIN_CHARS = 1_000;
const MIN_ROWS = 10;

function signature(rows: BoardRankEntry[]): string {
  return rows.map((row) => row.name).join("|");
}

function audit(entry: CachedBoard): string[] {
  const failures: string[] = [];

  if (entry.ranking.length < MIN_ROWS) {
    failures.push(`ranking ${entry.ranking.length}/${MIN_ROWS}`);
  }

  const descending = entry.ranking.every(
    (row, index) => index === 0 || row.score <= entry.ranking[index - 1].score,
  );
  if (!descending) failures.push("scores not descending");
  if (entry.ranking.some((row) => row.score > 100)) failures.push("score above 100");
  if (entry.indexValue > 100) failures.push("indexValue above 100");

  const genderSignatures = new Map<string, string[]>();
  for (const key of GENDER_SEGMENTS) {
    const rows = entry.demographics.gender[key] ?? [];
    if (rows.length < 5) failures.push(`gender.${key} ${rows.length}/5`);
    const sig = signature(rows);
    genderSignatures.set(sig, [...(genderSignatures.get(sig) ?? []), key]);
  }
  for (const [, keys] of genderSignatures) {
    if (keys.length > 1) failures.push(`duplicate gender: ${keys.join("=")}`);
  }

  const ageSignatures = new Map<string, string[]>();
  for (const key of AGE_SEGMENTS) {
    const rows = entry.demographics.age[key] ?? [];
    if (rows.length < 5) failures.push(`age.${key} ${rows.length}/5`);
    const sig = signature(rows);
    ageSignatures.set(sig, [...(ageSignatures.get(sig) ?? []), key]);
  }
  for (const [, keys] of ageSignatures) {
    if (keys.length > 1) failures.push(`duplicate age: ${keys.join("=")}`);
  }

  if (!Number.isFinite(entry.report.characterCount)) {
    failures.push("characterCount missing");
  } else if (entry.report.characterCount < MIN_CHARS) {
    failures.push(`chars ${entry.report.characterCount}/${MIN_CHARS}`);
  }

  if (!entry.report.table?.rows?.length) failures.push("table empty");
  if (!entry.report.table?.markdown?.includes("|")) failures.push("table markdown missing");
  if (entry.report.faq.length < 3) failures.push(`faq ${entry.report.faq.length}/3`);
  if (!entry.report.targetAnalysis?.paragraphs?.length) failures.push("targetAnalysis missing");
  if (!entry.report.sections.length) failures.push("sections empty");
  if (!entry.pump?.shortsScript?.length) failures.push("pump missing");
  if (!entry.pump?.pinnedComment) failures.push("pinnedComment missing");

  return failures;
}

async function main() {
  const entries = await listBoards();
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));

  let ok = 0;
  let failed = 0;
  const missing: string[] = [];

  for (const board of BOARDS) {
    const entry = bySlug.get(board.slug);
    if (!entry) {
      missing.push(board.slug);
      continue;
    }
    const failures = audit(entry);
    if (failures.length) {
      failed += 1;
      console.log(`FAIL ${board.slug} · ${failures.join(" · ")}`);
    } else {
      ok += 1;
      console.log(
        `ok   ${board.slug} · ${entry.provenance.kind} · ${entry.report.characterCount}자 · ` +
          `demo=${entry.provenance.demographicsFromLlm ? "llm" : "derived"}`,
      );
    }
  }

  console.log(
    `\n${ok} passed, ${failed} failed, ${missing.length} not generated (of ${BOARDS.length})`,
  );
  if (missing.length) console.log(`missing: ${missing.join(", ")}`);
  if (failed) process.exitCode = 1;
}

void main();
