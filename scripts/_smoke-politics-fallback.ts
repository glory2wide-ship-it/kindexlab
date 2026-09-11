import { fetchPoliticsSources } from "@/lib/ingestion/sources/politics";

async function main() {
  const results = await fetchPoliticsSources();
  for (const row of results) {
    console.log(
      `${row.ok ? "ok" : "BAD"} ${row.id} count=${row.count} ${row.label}${row.error ? ` err=${row.error}` : ""}`,
    );
  }
  const ok = results.filter((row) => row.ok).length;
  console.log(`politics ok ${ok}/${results.length}`);
  if (ok === 0) process.exitCode = 1;
}

void main();
