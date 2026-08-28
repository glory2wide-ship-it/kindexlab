import { catalogByType, matchPoliticsCatalog, politicsProducts, POLITICS_CATALOG } from "@/lib/politics/catalog";
import { politicsSlug, seedPoliticsRankings } from "@/lib/politics/seed";
import { POLITICS_TYPE_LABEL, POLITICS_TYPE_ORDER, type PoliticsEntityType } from "@/lib/politics/types";
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import { changeFromScores, scoreFromRank, sparklineFromHistory, volumeFromRank } from "@/lib/ingestion/score";
import type { ChartRow, IngestSnapshot, SourceResult } from "@/lib/ingestion/types";
import type { RankingEntity } from "@/lib/types";

const PER_TYPE = 10;

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
  const score = scoreFromRank(row.rank, size, 900, 1760) + Math.min(row.metric ?? 0, 24) * 7;
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

function rowsForType(sources: SourceResult[], type: PoliticsEntityType): ChartRow[] {
  const tagged = sources
    .filter((source) => source.id.startsWith("news-") || source.id === "google-trends")
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
          /대선|총선|국회|탄핵|공천|지지율|특검|개헌|계엄|정당|대통령/.test(item.title),
        )
      : [];
  return mergeRows([tagged, mentioned, headlines, trends]).slice(0, PER_TYPE);
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
  return [...crawled, ...extras].slice(0, PER_TYPE).map((row, index) => ({ ...row, rank: index + 1 }));
}

export function composePoliticsEntities(
  sources: SourceResult[],
  previous?: IngestSnapshot,
): RankingEntity[] {
  const liveCount = sources.filter((source) => source.ok && source.count > 0).length;
  if (!liveCount) return seedPoliticsRankings();

  const items: RankingEntity[] = [];
  for (const type of POLITICS_TYPE_ORDER) {
    const rows = fillFromCatalog(type, rowsForType(sources, type));
    items.push(...rows.map((row) => toEntity(row, type, previous, rows.length)));
  }
  return items;
}
