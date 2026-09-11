/**
 * Refresh thin LIVE boards into the on-disk snapshot without a full ingest.
 * Updates politics entities + targeted category-live boards (trot/party/pundit/…).
 *
 *   npx tsx --env-file=.env.local scripts/refresh-thin-live-boards.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  channelForBoardSlug,
  heatmapGroupForBoardSlug,
  entityTypeForBoardChannel,
} from "@/lib/boards/entity-type";
import { scoreFromRank, volumeFromRank, changeFromScores, sparklineFromHistory } from "@/lib/ingestion/score";
import { sanitizeTicketEntityName } from "@/lib/ingestion/sources/tickets";
import { fetchCategoryLiveForSlugs } from "@/lib/ingestion/sources/category-live";
import { fetchPoliticsSources } from "@/lib/ingestion/sources/politics";
import { fetchPoliticsYoutubeSources } from "@/lib/ingestion/sources/youtube-politics";
import { readPersistedSnapshot } from "@/lib/ingestion/job";
import { slugify } from "@/lib/ingestion/names";
import { composePoliticsEntities } from "@/lib/politics/compose";
import { isPoliticsEntityType } from "@/lib/politics/types";
import type { ChartRow } from "@/lib/ingestion/types";
import type { RankingEntity } from "@/lib/types";
import type { PostChannel } from "@/lib/posts/types";

const TARGET_SLUGS = [
  "trot-kayo-fandom-power",
  "party-support-chart",
  "political-pundit-ranking",
  "star-reputation-index",
  "recipe-ranking",
  "startup-franchise-index",
  "overseas-travel-ranking",
  "governor-approval-index",
  "housing-subscription-hotspot",
  "kospi-fomo-index",
  "rates-finance-products",
  "health-info-ranking",
];

function toBoardChartEntity(
  row: ChartRow,
  boardSlug: string,
  channel: PostChannel,
  heatmapGroup: string,
): RankingEntity {
  const rawTitle = (row.title ?? "").replace(/\s+/g, " ").trim();
  const title =
    boardSlug === "performance-ticket-ranking" || boardSlug === "exhibition-popup-ranking"
      ? sanitizeTicketEntityName(rawTitle)
      : rawTitle;
  const slug = `${boardSlug}--${slugify(title) || `item-${row.rank}`}`;
  const type = entityTypeForBoardChannel(boardSlug, channel);
  const score = scoreFromRank(row.rank, 30, 900, 1680);
  const fluctuationRate = row.previousRank
    ? Number((((row.previousRank - row.rank) / Math.max(row.previousRank, 1)) * 12).toFixed(2))
    : changeFromScores(score, undefined);
  const sparkline = sparklineFromHistory([], score);
  const tags = [...new Set([boardSlug, "live-chart", ...(row.tags ?? [])])].slice(0, 5);
  return {
    id: `live-${slug}`,
    slug,
    name: title,
    nameEn: row.subtitle && row.subtitle.length <= 32 ? row.subtitle : title,
    type,
    rank: row.rank,
    previousRank: row.previousRank ?? row.rank,
    buzzScore: score,
    openScore: Number((score / (1 + fluctuationRate / 100)).toFixed(2)),
    fluctuationRate,
    volume: row.volume ?? volumeFromRank(row.rank, 85_000),
    sparkline,
    history: [],
    tags,
    summary: `${title}은(는) ${heatmapGroup} 실시간 ${row.rank}위입니다.`,
    sourceChannel: channel,
    heatmapGroup,
  };
}

async function main() {
  const previous = readPersistedSnapshot();
  if (!previous?.items?.length) {
    console.error("No snapshot to refresh");
    process.exit(1);
  }

  console.log("fetching politics + youtube + thin category-live…");
  const [politics, politicsYoutube, categoryLive] = await Promise.all([
    fetchPoliticsSources(),
    fetchPoliticsYoutubeSources(),
    fetchCategoryLiveForSlugs(TARGET_SLUGS),
  ]);

  for (const source of [...politics, ...politicsYoutube, ...categoryLive]) {
    console.log(`${source.ok ? "ok" : "BAD"} ${source.id} n=${source.count} ${source.label}`);
  }

  const politicsEntities = composePoliticsEntities(
    [...politics, ...politicsYoutube],
    previous,
  );
  const categoryEntities = categoryLive.flatMap((source) => {
    const boardSlug =
      source.items[0]?.tags?.find((tag) => TARGET_SLUGS.includes(tag)) ??
      source.id.replace(/^live-[a-z]+-/, "");
    const channel = channelForBoardSlug(boardSlug);
    if (!channel) return [];
    return source.items.map((row) =>
      toBoardChartEntity(
        row,
        boardSlug,
        channel,
        heatmapGroupForBoardSlug(boardSlug) ?? boardSlug,
      ),
    );
  });

  const keep = previous.items.filter((item) => {
    if (isPoliticsEntityType(item.type)) return false;
    if (item.tags?.some((tag) => TARGET_SLUGS.includes(tag))) return false;
    if (TARGET_SLUGS.some((slug) => item.slug.startsWith(`${slug}--`))) return false;
    return true;
  });

  const items = [...keep, ...politicsEntities, ...categoryEntities];
  const updatedAt = new Date().toISOString();
  const nextSources = [
    ...(previous.sources ?? []).filter(
      (source) =>
        !String(source.id).startsWith("news-") &&
        source.id !== "youtube-politics-seeds" &&
        !TARGET_SLUGS.some((slug) => String(source.id).endsWith(slug)),
    ),
    ...[...politics, ...politicsYoutube, ...categoryLive].map((source) => ({
      id: source.id,
      ok: source.ok,
      count: source.count,
      error: source.error,
    })),
  ];

  const snapshot = {
    ...previous,
    updatedAt,
    status: items.length ? "open" : "closed",
    sources: nextSources,
    items,
  };

  const file = path.join(process.cwd(), "src", "data", "ingestion", "snapshot.json");
  writeFileSync(file, `${JSON.stringify(snapshot)}\n`);
  console.log(
    JSON.stringify(
      {
        updatedAt,
        itemCount: items.length,
        politicsEntities: politicsEntities.length,
        categoryEntities: categoryEntities.length,
        pundit: politicsEntities.filter((item) => item.type === "political_pundit").length,
        party: politicsEntities.filter((item) => item.type === "party_support").length,
        trotTagged: categoryEntities.filter((item) => item.tags?.includes("trot-kayo-fandom-power"))
          .length,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
