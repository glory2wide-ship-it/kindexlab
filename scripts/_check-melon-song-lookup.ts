/**
 * Smoke: Melon song lookup for music-board entities.
 *   npx tsx scripts/_check-melon-song-lookup.ts
 */
import assert from "node:assert/strict";
import { lookupMelonSong } from "../src/lib/entity/category-info/melon";

async function main() {
  const lemonade = await lookupMelonSong("LEMONADE", "aespa");
  assert.ok(lemonade, "LEMONADE/aespa should resolve");
  assert.equal(lemonade.songName.toUpperCase().includes("LEMONADE"), true);
  assert.match(lemonade.artistName, /aespa/i);
  assert.ok(lemonade.href.includes("songId="));

  const bad = await lookupMelonSong("BAD", "ATEEZ (에이티즈)");
  assert.ok(bad, "BAD/ATEEZ should resolve");
  assert.equal(bad.songName.toUpperCase(), "BAD");
  assert.match(bad.artistName, /ateez/i);

  // Must not confuse BAD TIMES with ATEEZ BAD.
  const badTimes = await lookupMelonSong("BAD TIMES", "Imael Angel");
  if (badTimes) {
    assert.notEqual(badTimes.songName.toUpperCase(), "BAD");
    assert.match(badTimes.artistName, /imael|angel|mike/i);
  }

  console.log("melon song lookup checks ok", {
    lemonade: `${lemonade.chartRank ?? "-"} ${lemonade.songName}`,
    bad: `${bad.chartRank ?? "-"} ${bad.songName}`,
    badTimes: badTimes
      ? `${badTimes.source} ${badTimes.songName} / ${badTimes.artistName}`
      : "miss (ok if Melon has no Imael track)",
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
