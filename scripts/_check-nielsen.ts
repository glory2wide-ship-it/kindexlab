async function main() {
  const { fetchBroadcastSources } = await import("@/lib/ingestion/sources/broadcast");
  const sources = await fetchBroadcastSources();

  for (const source of sources) {
    console.log(`\n=== ${source.id} · ${source.label} · ok=${source.ok} · ${source.count}행 ===`);
    if (source.error) console.log(`  error: ${source.error}`);
    for (const row of source.items.slice(0, 12)) {
      console.log(
        `  ${String(row.rank).padStart(3)}위`,
        `metric=${String(row.metric ?? "-").padEnd(10)}`,
        `측정값=${row.measurement ? `${row.measurement.value}${row.measurement.unit}` : "없음"}`.padEnd(
          16,
        ),
        row.title.slice(0, 28),
      );
    }
    const metrics = source.items.map((r) => r.metric).filter((m) => typeof m === "number");
    if (metrics.length) {
      console.log(
        `  metric 범위: ${Math.min(...metrics)} ~ ${Math.max(...metrics)} · 18 초과: ${
          metrics.filter((m) => m > 18).length
        }/${metrics.length}`,
      );
    }
  }
}

void main();

export {};
