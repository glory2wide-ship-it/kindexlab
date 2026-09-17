/**
 * Guards for "최근 히트곡" quality — reject agency/news scraps.
 *   npx tsx scripts/_check-hit-songs.ts
 */
import assert from "node:assert/strict";
import { buildCategoryInfoPayload } from "../src/lib/entity/category-info/build";
import {
  extractHitSongs,
  hitSongsFromMusicChartPeers,
  isPlausibleHitSongTitle,
  pickHitSongs,
  sanitizeHitSongTitles,
} from "../src/lib/entity/category-info/hit-songs";
import { resolveEntertainmentFacts } from "../src/lib/boards/entertainment-facts";
import type { RankingEntity } from "../src/lib/types";

function entity(
  partial: Partial<RankingEntity> & Pick<RankingEntity, "name" | "slug" | "type">,
): RankingEntity {
  return {
    id: partial.id ?? `board:${partial.slug}`,
    slug: partial.slug,
    name: partial.name,
    nameEn: partial.nameEn ?? partial.name,
    type: partial.type,
    rank: partial.rank ?? 1,
    previousRank: partial.previousRank ?? 2,
    score: partial.score ?? 1000,
    openScore: partial.openScore ?? 1000,
    fluctuationRate: partial.fluctuationRate ?? 1,
    volume: partial.volume ?? 100,
    tags: partial.tags ?? [],
    summary: partial.summary ?? `${partial.name} 요약`,
    sourceChannel: partial.sourceChannel ?? "entertainment",
    heatmapGroup: partial.heatmapGroup ?? "K POP",
    ...partial,
  };
}

const JUNK = "정보 빅 히트 뮤직 막내아이돌 마";

assert.equal(isPlausibleHitSongTitle(JUNK), false, "reject HYBE/빅히트 scrap");
assert.equal(isPlausibleHitSongTitle("BAD TIMES"), true);
assert.equal(isPlausibleHitSongTitle("Movin' To The Sun"), true);
assert.equal(isPlausibleHitSongTitle("I'm Alive"), true);
assert.equal(isPlausibleHitSongTitle("Dynamite"), true);
assert.equal(isPlausibleHitSongTitle("HYBE 빅히트 뮤직"), false);
assert.equal(isPlausibleHitSongTitle("소속사 정보"), false);

const scraped = extractHitSongs(
  `Imael Angel 관련 기사. 히트곡 ${JUNK} 공개. HYBE 빅히트 뮤직 막내아이돌 소식.`,
  "Imael Angel",
);
assert.deepEqual(scraped, [], "corpus extract must not return agency junk");

const quoted = extractHitSongs(
  `Imael Angel의 히트곡 "BAD TIMES" 발매. “I'm Alive” 공개.`,
  "Imael Angel",
);
assert.ok(quoted.includes("BAD TIMES"), `expected BAD TIMES in ${quoted.join(",")}`);
assert.ok(
  quoted.some((s) => /Alive/i.test(s)),
  `expected I'm Alive in ${quoted.join(",")}`,
);

const peers: RankingEntity[] = [
  entity({
    name: "BAD TIMES",
    nameEn: "Imael Angel",
    slug: "bad-times",
    type: "music_chart",
  }),
  entity({
    name: "노스탈지아",
    nameEn: "BIG Naughty",
    slug: "nostalgia",
    type: "music_chart",
  }),
];
assert.deepEqual(
  hitSongsFromMusicChartPeers("Imael Angel", peers),
  ["BAD TIMES"],
);
assert.deepEqual(
  sanitizeHitSongTitles([JUNK, "BAD TIMES", "HYBE"], "Imael Angel"),
  ["BAD TIMES"],
);
assert.deepEqual(
  pickHitSongs("Imael Angel", [JUNK], ["BAD TIMES"], ["I'm Alive"]),
  ["BAD TIMES"],
);

const imaerAngel = entity({
  name: "Imael Angel",
  slug: "imael-angel",
  type: "kpop",
  heatmapGroup: "K POP",
});
const facts = resolveEntertainmentFacts(imaerAngel);
assert.ok(facts, "Imael Angel must resolve entertainment facts");
const hitChip = facts!.chips?.find((c) => /히트|곡/.test(c.label));
assert.ok(hitChip?.items.length, "catalog must list hit songs");
assert.ok(
  hitChip!.items.every((item) => isPlausibleHitSongTitle(item, "Imael Angel")),
  `catalog songs must be plausible: ${hitChip!.items.join(" · ")}`,
);
assert.ok(
  hitChip!.items.includes("BAD TIMES"),
  `expected BAD TIMES, got ${hitChip!.items.join(" · ")}`,
);
assert.ok(
  !hitChip!.items.some((item) => item.includes("빅 히트") || item.includes(JUNK)),
  "catalog must not contain junk",
);

const payload = buildCategoryInfoPayload(imaerAngel);
const builtChip = payload.chips.find((c) => /히트|곡/.test(c.label));
assert.ok(builtChip?.items.includes("BAD TIMES"), "build payload keeps BAD TIMES");
assert.ok(
  !builtChip?.items.some((item) => /빅\s*히트|정보\s|막내아이돌/.test(item)),
  "build payload rejects junk chips",
);

console.log("hit-songs OK");
