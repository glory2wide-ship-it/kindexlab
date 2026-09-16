/**
 * Smoke: webtoon / book / ticket / food specialized lookups.
 *   npx tsx scripts/_check-media-lookups.ts
 */
import assert from "node:assert/strict";
import { enrichCategoryInfoPayload } from "../src/lib/entity/category-info/enrich";
import { buildCategoryInfoPayload } from "../src/lib/entity/category-info/build";
import { lookupBookFacts } from "../src/lib/entity/category-info/lookup-book";
import { lookupFoodFacts } from "../src/lib/entity/category-info/lookup-food";
import { lookupTicketFacts } from "../src/lib/entity/category-info/lookup-tickets";
import { lookupWebtoonFacts } from "../src/lib/entity/category-info/lookup-webtoon";
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
    sourceChannel: partial.sourceChannel,
    heatmapGroup: partial.heatmapGroup,
    ...partial,
  };
}

async function main() {
  const webtoon = await lookupWebtoonFacts("외모지상주의");
  console.log("webtoon:", webtoon ? `${webtoon.platform} · ${webtoon.author ?? "-"}` : "miss");
  if (webtoon) {
    assert.ok(webtoon.platform.includes("네이버") || webtoon.platform.includes("카카오"));
  }

  const book = await lookupBookFacts("세이노의 가르침");
  console.log("book:", book ? `${book.source} · ${book.author ?? "-"} / ${book.publisher ?? "-"}` : "miss");
  assert.ok(book?.author || book?.publisher, "book lookup should resolve author/publisher");

  const ticketLive = await lookupTicketFacts("드라큘라", "performance");
  console.log(
    "ticket(live):",
    ticketLive
      ? `${ticketLive.source} · ${ticketLive.venue ?? "-"} · ${ticketLive.schedule ?? ticketLive.price ?? "-"}`
      : "miss",
  );
  assert.ok(ticketLive?.venue || ticketLive?.schedule, "interpark ranking crawl should hit 드라큘라");

  const ticket = await lookupTicketFacts("팬텀", "performance");
  console.log(
    "ticket(search):",
    ticket
      ? `${ticket.source} · ${ticket.venue ?? "-"} · ${ticket.schedule ?? ticket.price ?? "-"}`
      : "miss",
  );

  const food = await lookupFoodFacts("광장시장 마약김밥");
  console.log(
    "food:",
    food
      ? `${food.source} · ${food.address ?? food.url ?? "-"}`
      : "miss",
  );

  const cases = [
    entity({
      name: "외모지상주의",
      slug: "realtime-webtoon-rank--외모지상주의",
      type: "webtoon",
      heatmapGroup: "웹툰",
      sourceChannel: "entertainment",
    }),
    entity({
      name: "세이노의 가르침",
      slug: "bestseller-surge-index--세이노의-가르침",
      type: "book",
      heatmapGroup: "도서 베스트셀러",
      sourceChannel: "culture",
    }),
    entity({
      name: "뮤지컬 팬텀",
      slug: "performance-ticket-ranking--뮤지컬-팬텀",
      type: "performance",
      heatmapGroup: "공연",
      sourceChannel: "culture",
    }),
    entity({
      name: "[서울] 광장시장 마약김밥",
      slug: "regional-food-hotspot--광장시장-마약김밥",
      type: "restaurant",
      heatmapGroup: "지역별 음식/맛집",
      sourceChannel: "travel",
    }),
  ];

  for (const row of cases) {
    const base = buildCategoryInfoPayload(row);
    const enriched = await enrichCategoryInfoPayload(base);
    assert.equal(enriched.channel, base.channel, row.slug);
    assert.ok(enriched.rows.length >= 1, `${row.slug} rows`);
    const labels = enriched.rows.map((r) => r.label);
    assert.equal(labels.length, new Set(labels).size, `${row.slug} duplicate labels`);
    console.log(
      `enrich ${row.slug}: channel=${enriched.channel} filled=${enriched.rows.filter((r) => !/확인 중|업데이트 중|준비 중/.test(r.value)).length}/${enriched.rows.length} links=${enriched.links.length}`,
    );
  }

  console.log("media-lookups OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
