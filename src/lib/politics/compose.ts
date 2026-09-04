import { catalogByType, matchPoliticsCatalog, politicsProducts, POLITICS_CATALOG } from "@/lib/politics/catalog";
import { carryForwardInfluencerEntities } from "@/lib/politics/fail-safe";
import { politicsSlug, seedPoliticsRankings } from "@/lib/politics/seed";
import { POLITICS_TYPE_LABEL, POLITICS_TYPE_ORDER, type PoliticsEntityType } from "@/lib/politics/types";
import {
  influencerSeedNames,
  matchPoliticsYoutubeSeed,
  POLITICS_YOUTUBE_SEEDS,
} from "@/lib/politics/youtube-seeds";
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import { changeFromScores, scoreFromRank, sparklineFromHistory, volumeFromRank } from "@/lib/ingestion/score";
import { politicsYoutubeSeedRows } from "@/lib/ingestion/sources/youtube-politics";
import type { ChartRow, IngestSnapshot, SourceResult } from "@/lib/ingestion/types";
import type { RankingEntity } from "@/lib/types";

const PER_TYPE = 20;

function history(values: number[]): RankingEntity["history"] {
  const labels = ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "오늘"];
  return values.map((v, i) => ({ t: labels[i] ?? `${i}`, v }));
}

function mergeRows(groups: ChartRow[][]): ChartRow[] {
  const map = new Map<string, ChartRow>();
  for (const group of groups) {
    for (const row of group) {
      const key = normalizeName(row.title);
      if (!key) continue;
      const current = map.get(key);
      if (!current || (row.metric ?? 0) > (current.metric ?? 0)) {
        map.set(key, {
          ...row,
          metric: (current?.metric ?? 0) + (row.metric ?? 0),
          tags: [...new Set([...(current?.tags ?? []), ...(row.tags ?? [])])],
        });
      } else {
        current.metric = (current.metric ?? 0) + (row.metric ?? 0);
        current.tags = [...new Set([...(current.tags ?? []), ...(row.tags ?? [])])];
      }
    }
  }
  return [...map.values()].sort((a, b) => (b.metric ?? 0) - (a.metric ?? 0));
}

function toEntity(
  row: ChartRow,
  type: PoliticsEntityType,
  previous: IngestSnapshot | undefined,
  size: number,
): RankingEntity {
  const catalog = POLITICS_CATALOG.find(
    (item) => item.type === type && namesOverlap(item.name, row.title),
  );
  const title = catalog?.name ?? row.title;
  const slug = politicsSlug(type, title);
  // Mention counts were folded in linearly against a hard cap, so every board's
  // leader cleared it and landed on the same score: 당 지지도, 정치인 지지도, 시사
  // 채널, 검색어 all tied at 1928 and sat together near the top of the board
  // regardless of how their coverage moved. A log curve keeps the busiest
  // subjects apart without letting one runaway count dominate the band.
  const weight = type === "political_influencer" ? 150 : 105;
  const ceiling = type === "political_influencer" ? 450 : 250;
  const bonus = Math.min(Math.log10(1 + Math.max(row.metric ?? 0, 0)) * weight, ceiling);
  const score = scoreFromRank(row.rank, size, 900, 1760) + bonus;
  const historyScores = previous?.scoreHistory?.[slug] ?? [];
  const previousScore = historyScores.at(-1);
  const fluctuationRate = row.previousRank
    ? Number((((row.previousRank - row.rank) / Math.max(row.previousRank, 1)) * 10).toFixed(2))
    : changeFromScores(score, previousScore);
  const sparkline = sparklineFromHistory(historyScores, score);
  const volume = row.volume ?? volumeFromRank(row.rank, type === "subsidy" ? 120_000 : 82_000);
  const tags = [...new Set([...(catalog?.tags ?? []), ...(row.tags ?? []), POLITICS_TYPE_LABEL[type]])].slice(0, 5);
  const label = POLITICS_TYPE_LABEL[type];
  return {
    id: `pol-${slug}`,
    slug,
    name: title,
    nameEn: catalog?.nameEn || row.subtitle || title,
    type,
    rank: row.rank,
    previousRank: row.previousRank ?? row.rank,
    buzzScore: Number(score.toFixed(2)),
    openScore: previousScore ?? Number((score / (1 + fluctuationRate / 100)).toFixed(2)),
    fluctuationRate,
    volume,
    sparkline,
    history: history(sparkline),
    tags: tags.length ? tags : [label],
    summary: `${title}은(는) ${label} 기준으로 ${row.rank}위입니다. 등락 ${fluctuationRate.toFixed(2)}%, 거래량 대용치는 ${volume.toLocaleString("ko-KR")}입니다.`,
    analysis: `${title} 수급은 정치 전용 뉴스 RSS·검색 키워드·시사 채널 언급을 합산합니다. 정당·정치인 지지도는 공식 여론조사가 아니라 화제성 대용치이며, 정부 지원금 순위는 검색·보도량 기준입니다.`,
    products: catalog ? politicsProducts(catalog) : [
      {
        id: `pol-live-${slug}-1`,
        name: `${title} 시사 자료`,
        brand: "큐레이션",
        priceKrw: 16900,
        reason: `${title} 관련 검색 수요`,
        searchQuery: type === "subsidy" ? title : "시사 도서",
        category: type === "subsidy" ? "지원금" : "시사",
      },
    ],
  };
}

function canonicalizeInfluencerTitle(title: string): string {
  return matchPoliticsYoutubeSeed(title)?.name ?? title;
}

function rowsForType(sources: SourceResult[], type: PoliticsEntityType): ChartRow[] {
  const tagged = sources
    .filter((source) => source.id.startsWith("news-") || source.id === "google-trends" || source.id === "youtube-politics-seeds")
    .flatMap((source) => source.items.filter((item) => (item.tags ?? []).includes(type)));
  const mentioned = sources.flatMap((source) =>
    source.items.flatMap((item) =>
      matchPoliticsCatalog(`${item.title} ${item.subtitle ?? ""}`)
        .filter((entry) => entry.type === type)
        .map((entry) => ({
          rank: item.rank,
          title: entry.name,
          subtitle: entry.nameEn,
          metric: item.metric ?? 1,
          tags: [...(item.tags ?? []), type],
        })),
    ),
  );
  const headlines =
    type === "headline_news"
      ? sources
          .filter((source) => source.id.startsWith("news-politics"))
          .flatMap((source) => source.items.filter((item) => (item.title?.length ?? 0) >= 6))
      : [];
  const trends =
    type === "political_search"
      ? (sources.find((source) => source.id === "google-trends")?.items ?? []).filter((item) =>
          /대선|총선|국회|탄핵|공천|지지율|특검|개헌|계엄|정당|대통령|종부세|종합부동산|연금|상속세|의대|전세|금투세|양도|법인세|최저임금|노란봉투|검찰|공수처|중대재해|탄소|원전|기본소득|청년도약/.test(
            item.title,
          ),
        )
      : [];
  const youtube =
    type === "political_influencer"
      ? (sources.find((source) => source.id === "youtube-politics-seeds")?.items ?? politicsYoutubeSeedRows()).map(
          (item) => ({
            ...item,
            title: canonicalizeInfluencerTitle(item.title),
            tags: [...new Set([...(item.tags ?? []), "political_influencer"])],
          }),
        )
      : [];
  const dualSeeds =
    type === "political_influencer"
      ? POLITICS_YOUTUBE_SEEDS.filter((seed) => seed.influencer && seed.types.includes("political_pundit")).map(
          (seed, index) => ({
            rank: index + 1,
            title: seed.name,
            subtitle: seed.nameEn,
            metric: Math.max(20, 70 - index * 4),
            tags: ["political_influencer", "시사", "유튜브"],
          }),
        )
      : [];
  return mergeRows([tagged, mentioned, headlines, trends, youtube, dualSeeds]).slice(0, PER_TYPE);
}

function fillFromCatalog(type: PoliticsEntityType, crawled: ChartRow[]): ChartRow[] {
  const used = crawled.map((row) => row.title);
  const extras = catalogByType(type)
    .filter((entry) => !used.some((name) => namesOverlap(name, entry.name)))
    .map((entry, index) => ({
      rank: crawled.length + index + 1,
      title: entry.name,
      subtitle: entry.nameEn,
      metric: Math.max(1, 8 - index),
      tags: [...entry.tags, type],
    }));
  const withCatalog = [...crawled, ...extras];
  if (type === "political_influencer") {
    for (const name of influencerSeedNames()) {
      const exists = withCatalog.some((row) => namesOverlap(row.title, name) || namesOverlap(name, row.title));
      if (exists) {
        const row = withCatalog.find((item) => namesOverlap(item.title, name) || namesOverlap(name, item.title));
        if (row) row.title = name;
        continue;
      }
      withCatalog.push({
        rank: withCatalog.length + 1,
        title: name,
        subtitle: matchPoliticsYoutubeSeed(name)?.nameEn,
        metric: name.includes("뉴스공장") ? 88 : 48,
        tags: ["political_influencer", "seed", "유튜브"],
      });
    }
    withCatalog.sort((left, right) => {
      const seeds = influencerSeedNames();
      const leftSeed = seeds.some((name) => namesOverlap(left.title, name)) ? 1 : 0;
      const rightSeed = seeds.some((name) => namesOverlap(right.title, name)) ? 1 : 0;
      if (leftSeed !== rightSeed) return rightSeed - leftSeed;
      const leftLead = /뉴스공장|겸손은/.test(left.title) ? 1 : 0;
      const rightLead = /뉴스공장|겸손은/.test(right.title) ? 1 : 0;
      if (leftLead !== rightLead) return rightLead - leftLead;
      return (right.metric ?? 0) - (left.metric ?? 0);
    });
  }
  return withCatalog.slice(0, Math.max(PER_TYPE, type === "political_influencer" ? 20 : PER_TYPE)).map((row, index) => ({
    ...row,
    rank: index + 1,
    title: type === "political_influencer" ? canonicalizeInfluencerTitle(row.title) : row.title,
  }));
}

export function composePoliticsEntities(
  sources: SourceResult[],
  previous?: IngestSnapshot,
): RankingEntity[] {
  const liveCount = sources.filter((source) => source.ok && source.count > 0).length;
  if (!liveCount) {
    return carryForwardInfluencerEntities(seedPoliticsRankings(), previous?.items);
  }

  const items: RankingEntity[] = [];
  for (const type of POLITICS_TYPE_ORDER) {
    const rows = fillFromCatalog(type, rowsForType(sources, type));
    items.push(...rows.map((row) => toEntity(row, type, previous, rows.length)));
  }
  return carryForwardInfluencerEntities(items, previous?.items);
}
