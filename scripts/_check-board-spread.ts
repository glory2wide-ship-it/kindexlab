/**
 * Composes a live snapshot in memory and reports how much of the board is tied.
 *
 * Deliberately does not persist: the question is whether scores spread enough
 * for the ordering to move, and answering it should not overwrite the committed
 * snapshot.
 */
async function main() {
  const { composeLiveSnapshot } = await import("@/lib/ingestion/compose");
  const { readPersistedSnapshot } = await import("@/lib/ingestion/job");
  const { fetchBroadcastSources } = await import("@/lib/ingestion/sources/broadcast");
  const { fetchBuzzSources } = await import("@/lib/ingestion/sources/buzz");
  const { fetchGameSources } = await import("@/lib/ingestion/sources/games");
  const { fetchMusicSources } = await import("@/lib/ingestion/sources/music");
  const { fetchShortsSources } = await import("@/lib/ingestion/sources/shorts");
  const { fetchPoliticsSources } = await import("@/lib/ingestion/sources/politics");
  const { fetchPoliticsYoutubeSources } = await import("@/lib/ingestion/sources/youtube-politics");
  const { fetchWebtoonSources } = await import("@/lib/ingestion/sources/webtoon");

  const previous = readPersistedSnapshot();
  const groups = await Promise.all([
    fetchMusicSources(),
    fetchBroadcastSources(),
    fetchBuzzSources(),
    fetchWebtoonSources(),
    fetchShortsSources(),
    fetchGameSources(),
    fetchPoliticsSources(),
    fetchPoliticsYoutubeSources(),
  ]);
  const composed = await composeLiveSnapshot(groups.flat(), previous);
  const items = composed.items;

  const counts = new Map<number, number>();
  for (const item of items) counts.set(item.buzzScore, (counts.get(item.buzzScore) ?? 0) + 1);
  const tied = [...counts.values()].filter((c) => c > 1).reduce((a, b) => a + b, 0);

  const topCounts = new Map<number, number>();
  for (const item of items.slice(0, 25)) {
    topCounts.set(item.buzzScore, (topCounts.get(item.buzzScore) ?? 0) + 1);
  }
  const topTied = [...topCounts.values()].filter((c) => c > 1).reduce((a, b) => a + b, 0);

  console.log("\n상위 15개");
  for (const item of items.slice(0, 15)) {
    console.log(
      "  ",
      String(item.buzzScore).padStart(9),
      item.type.padEnd(20),
      item.name.slice(0, 28),
    );
  }

  console.log(`\n항목 ${items.length} · 고유 점수 ${counts.size}`);
  console.log(`동점에 묶인 항목 ${tied} (${Math.round((tied / items.length) * 100)}%)`);
  console.log(`상위 25 내 동점 ${topTied}`);
  console.log(`바닥(880) 동점 ${items.filter((i) => i.buzzScore === 880).length}`);
  console.log(`측정값 보유 ${items.filter((i) => i.measurement).length}`);
}

void main();

export {};
