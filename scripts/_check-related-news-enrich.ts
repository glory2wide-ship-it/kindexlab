/**
 * Smoke: enrich fills real press permalinks (no search placeholders).
 *   npx tsx scripts/_check-related-news-enrich.ts
 */
import assert from "node:assert/strict";
import { buildCategoryInfoPayload } from "../src/lib/entity/category-info/build";
import { enrichCategoryInfoPayload } from "../src/lib/entity/category-info/enrich";
import { isNewsSearchFallbackUrl } from "../src/lib/entity/category-info/news";
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

const cases: RankingEntity[] = [
  entity({
    name: "[국세청] 근로장려금",
    slug: "public-support-fund--근로장려금",
    type: "support_fund",
    heatmapGroup: "지원금",
    sourceChannel: "economy",
  }),
  entity({
    name: "삼성전자",
    slug: "kospi-fomo-index--삼성전자",
    type: "stock_market",
    heatmapGroup: "주식",
    sourceChannel: "economy",
  }),
  entity({
    name: "BTS",
    slug: "kpop-fandom-power--BTS",
    type: "kpop",
    heatmapGroup: "K POP",
    sourceChannel: "entertainment",
  }),
];

async function main() {
  for (const row of cases) {
    const base = buildCategoryInfoPayload(row);
    const enriched = await enrichCategoryInfoPayload(base);
    const search = enriched.links.filter((link) => isNewsSearchFallbackUrl(link.href));
    const placeholders = enriched.links.filter((link) => /추가 수집 중/.test(link.title));
    assert.equal(search.length, 0, `${row.slug}: search fallbacks`);
    assert.equal(placeholders.length, 0, `${row.slug}: 추가 수집 중 titles`);
    assert.ok(
      enriched.links.length >= 1,
      `${row.slug}: expected ≥1 real news link, got ${enriched.links.length}`,
    );
    console.log(
      "ok",
      row.name,
      enriched.links.length,
      enriched.links.slice(0, 2).map((l) => ({
        t: l.title.slice(0, 40),
        h: l.href.slice(0, 50),
      })),
    );
  }
  console.log("related-news-enrich OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
