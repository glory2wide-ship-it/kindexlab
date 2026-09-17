/**
 * CI gates for board entity quality — party / politician / TV / star / movie.
 * Fails when known junk or cross-board contaminants would paint on heatmaps.
 *
 *   npx tsx scripts/_check-board-entity-guards.ts
 */
import { isLikelyCelebrityName } from "../src/lib/boards/celebrity";
import { isLikelyMovieTitle } from "../src/lib/boards/movie-title";
import { isLikelyPartyName } from "../src/lib/boards/party-name";
import { isLikelyTvProgramName } from "../src/lib/boards/tv-program";
import { politicianPartyName } from "../src/lib/politics/politician-party";
import { inferTvChannelChip } from "../src/lib/heatmap-rank-meta";

const cases: { label: string; ok: boolean }[] = [];

function expect(label: string, ok: boolean) {
  cases.push({ label, ok });
}

function main() {
  // Party board: politician 조국 must never pass; 조국혁신당 must.
  expect("party rejects 조국", !isLikelyPartyName("조국"));
  expect("party accepts 조국혁신당", isLikelyPartyName("조국혁신당"));
  expect("party rejects news lede", !isLikelyPartyName("[뉴스] 이 대통령 지지율 38%"));
  expect("party accepts 국민의힘", isLikelyPartyName("국민의힘"));

  // Politician party badges for frequently missing names.
  for (const [person, party] of [
    ["장동혁", "국민의힘"],
    ["홍준표", "국민의힘"],
    ["나경원", "국민의힘"],
    ["김민석", "더불어민주당"],
    ["원희룡", "국민의힘"],
    ["심상정", "정의당"],
    ["조국", "조국혁신당"],
  ] as const) {
    expect(`politician badge ${person}`, politicianPartyName(person) === party);
  }

  // Star: media outlets + incident headlines out; person names in.
  expect("star rejects 중앙일보", !isLikelyCelebrityName("중앙일보"));
  expect("star rejects 조선일보", !isLikelyCelebrityName("조선일보"));
  expect("star rejects 부산 추락사", !isLikelyCelebrityName("부산 추락사"));
  expect("star rejects 강남 화재", !isLikelyCelebrityName("강남 화재"));
  expect("star accepts 아이유", isLikelyCelebrityName("아이유"));

  // TV: 깜짝 is idol-news scrap, not a programme; known shows keep channel chips.
  expect("tv rejects 깜짝", !isLikelyTvProgramName("깜짝"));
  expect("tv rejects 활짝", !isLikelyTvProgramName("활짝"));
  expect("tv accepts 나 혼자 산다", isLikelyTvProgramName("나 혼자 산다"));
  expect(
    "tv channel chip 인간극장",
    inferTvChannelChip({ name: "인간극장", type: "tv_show", slug: "인간극장" }) === "KBS",
  );
  expect(
    "tv channel chip 슈돌",
    inferTvChannelChip({ name: "슈돌", type: "tv_show", slug: "슈돌" }) === "MBC",
  );

  // Movie scrape chrome / ads / domains.
  const movieJunk = [
    "선택하신 조건에 해당하는 영화가 없습니다. 다른 조건을 선택해 주세요.",
    "네이버 인플루언서",
    "일시적인 오류가 발생했습니다.",
    "gimje.go.kr",
    "최신 기술을 품은 네이버 웨일에서 빠른 인터넷을 만나보세요",
  ];
  for (const name of movieJunk) {
    expect(`movie rejects ${name.slice(0, 24)}`, !isLikelyMovieTitle(name));
  }
  expect("movie accepts 오펜하이머", isLikelyMovieTitle("오펜하이머"));

  const failed = cases.filter((item) => !item.ok);
  for (const item of cases) {
    console.log(`${item.ok ? "ok" : "FAIL"}  ${item.label}`);
  }
  if (failed.length) {
    console.error(`\nboard-entity guards: ${failed.length} failure(s)`);
    process.exit(1);
  }
  console.log(`\nboard-entity guards: ${cases.length} checks passed`);
}

main();
