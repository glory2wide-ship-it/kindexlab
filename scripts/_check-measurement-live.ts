/**
 * Local dev serves the mock fixture (getTrendsSource falls back to "mock" off
 * Vercel), so a page fetch cannot show whether measurements survive the real
 * provider path. Force the live source and read the entity the detail page
 * would read.
 */
process.env.TRENDS_DATA_SOURCE = "live";

async function main() {
  const { getRankings, getEntityBySlug } = await import("@/lib/providers/trends");

  const payload = await getRankings();
  const measured = payload.items.filter((item) => item.measurement);

  console.log(`live 소스 항목 ${payload.items.length}개 · 측정값 보유 ${measured.length}개\n`);

  for (const item of measured.slice(0, 6)) {
    const entity = await getEntityBySlug(item.slug);
    const m = entity?.measurement;
    console.log(
      (m ? "보존 O" : "보존 X").padEnd(8),
      `${m?.value ?? "-"}${m?.unit ?? ""}`.padEnd(14),
      (m?.label ?? "-").padEnd(12),
      (m?.changeRate === undefined ? "등락 없음" : `등락 ${m.changeRate}%`).padEnd(14),
      item.name.slice(0, 24),
    );
  }
}

void main();
