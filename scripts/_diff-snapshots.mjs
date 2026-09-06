import { execSync } from "node:child_process";

/** Top entities of a snapshot as committed at a given revision. */
function topAt(rev, limit = 25) {
  const json = execSync(`git show ${rev}:src/data/ingestion/snapshot.json`, {
    encoding: "utf8",
    maxBuffer: 200 * 1024 * 1024,
  });
  const snap = JSON.parse(json);
  return {
    updatedAt: snap.updatedAt,
    names: (snap.items ?? []).slice(0, limit).map((i) => i.name),
    moved: (snap.items ?? []).filter((i) => i.fluctuationRate !== 0).length,
    total: (snap.items ?? []).length,
  };
}

const revs = execSync(
  "git log origin/main --format=%H -- src/data/ingestion/snapshot.json",
  { encoding: "utf8" },
)
  .trim()
  .split("\n");

// Newest, ~1h back, ~3h back: enough spread that a live board should reshuffle.
const picks = [revs[0], revs[5], revs[15], revs[30]].filter(Boolean);

const rows = picks.map((rev) => ({ rev: rev.slice(0, 7), ...topAt(rev) }));

console.log("커밋      갱신시각                  항목  등락≠0  상위25 첫 5개");
for (const row of rows) {
  console.log(
    row.rev.padEnd(9),
    row.updatedAt.padEnd(25),
    String(row.total).padEnd(5),
    `${row.moved}`.padEnd(7),
    row.names.slice(0, 5).join(", ").slice(0, 60),
  );
}

const newest = rows[0];
console.log("\n최신 대비 상위 25 일치율:");
for (const row of rows.slice(1)) {
  const same = row.names.filter((n, i) => n === newest.names[i]).length;
  const overlap = row.names.filter((n) => newest.names.includes(n)).length;
  console.log(
    `  ${row.rev}  같은 자리 ${same}/25 · 집합 겹침 ${overlap}/25  (${row.updatedAt.slice(11, 19)})`,
  );
}
