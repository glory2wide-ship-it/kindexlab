import { matchCatalog } from "@/lib/ingestion/catalog";
import { namesOverlap, normalizeName, slugify } from "@/lib/ingestion/names";
import {
  changeFromScores,
  scoreFromMetric,
  scoreFromRank,
  sparklineFromHistory,
  volumeFromRank,
} from "@/lib/ingestion/score";
import { classifyBuzzType, fetchNaverNewsBoost } from "@/lib/ingestion/sources/buzz";
import { pickPrimaryMusic } from "@/lib/ingestion/sources/music";
import type { CatalogMatch, ChartRow, IngestSnapshot, SourceResult } from "@/lib/ingestion/types";
import type { AffiliateProduct, EntityType, MarketIndex, RankingEntity, RankingsPayload } from "@/lib/types";

const INDEX_META: { id: string; label: string; type?: EntityType; note: string }[] = [
  { id: "k-buzz", label: "엔터버즈 종합", note: "실시간 수집 합산" },
  { id: "kpop", label: "K-POP지수", type: "kpop", note: "차트 아티스트 수급" },
  { id: "broadcast", label: "방송지수", type: "tv_show", note: "편성·화제 합산" },
  { id: "celebrity", label: "셀럽지수", type: "celebrity", note: "검색·뉴스 버즈" },
  { id: "influencer", label: "인플지수", type: "influencer", note: "크리에이터 언급" },
  { id: "music", label: "음원지수", type: "music_chart", note: "국내 음원 차트" },
  { id: "ratings", label: "시청률지수", type: "tv_rating", note: "닐슨 가구 시청률" },
];

function cleanTitle(value: string): string {
  const stripped = value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/본$|재$|생$/, "")
    .trim();
  const inner = stripped.match(/\(([^)]+)\)/);
  if (
    inner?.[1] &&
    inner[1].length >= 2 &&
    inner[1].length <= 24 &&
    /드라마|예능/.test(stripped) &&
    !/^\d/.test(inner[1])
  ) {
    return inner[1].trim();
  }
  return stripped;
}

function defaultProducts(name: string, type: EntityType): AffiliateProduct[] {
  const queries =
    type === "music_chart"
      ? [`${name} 앨범`, "무선 이어폰", "응원봉"]
      : type === "tv_show" || type === "tv_rating"
        ? [`${name} 굿즈`, "홈시네마 프로젝터", "팝콘"]
        : [`${name} 굿즈`, `${name} 모자`, "포토카드 바인더"];
  return queries.map((searchQuery, index) => ({
    id: `live-${slugify(name)}-${index + 1}`,
    name: searchQuery,
    brand: "큐레이션",
    priceKrw: 12900 + index * 8000,
    reason: `${name} 관련 검색 수요`,
    searchQuery,
    category: index === 0 ? "팬굿즈" : "리빙",
  }));
}

function historyPoints(values: number[]): RankingEntity["history"] {
  const labels = ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "오늘"];
  return values.map((v, i) => ({ t: labels[i] ?? `${i}`, v }));
}

function takeTop(rows: ChartRow[], limit: number): ChartRow[] {
  return [...rows]
    .filter((row) => cleanTitle(row.title).length >= 1)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
}

function mergeRows(groups: ChartRow[][]): ChartRow[] {
  const map = new Map<string, ChartRow>();
  for (const group of groups) {
    for (const row of group) {
      const key = normalizeName(row.title);
      if (!key) continue;
      const current = map.get(key);
      if (!current || row.rank < current.rank) {
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
  return [...map.values()].sort((a, b) => a.rank - b.rank || (b.metric ?? 0) - (a.metric ?? 0));
}

function artistRows(music: ChartRow[]): ChartRow[] {
  const map = new Map<string, ChartRow>();
  music.forEach((row, index) => {
    const artist = cleanTitle(row.subtitle ?? "");
    if (!artist) return;
    const current = map.get(normalizeName(artist));
    const rank = current ? Math.min(current.rank, index + 1) : index + 1;
    map.set(normalizeName(artist), {
      rank,
      title: artist,
      metric: (current?.metric ?? 0) + Math.max(1, 40 - index),
      tags: [...new Set([...(current?.tags ?? []), ...(row.tags ?? []), "아티스트"])],
    });
  });
  return [...map.values()].sort((a, b) => a.rank - b.rank);
}

function toEntity(
  row: ChartRow,
  type: EntityType,
  previous: IngestSnapshot | undefined,
  extraTags: string[],
): RankingEntity {
  const title = cleanTitle(row.title);
  const catalog: CatalogMatch | undefined = matchCatalog(title, row.subtitle);
  const slug = catalog?.slug ?? slugify(title);
  const knownType = catalog?.type ?? type;
  const score =
    row.metric && type === "tv_rating"
      ? scoreFromMetric(row.metric)
      : row.metric && (type === "celebrity" || type === "influencer")
        ? scoreFromRank(row.rank, 20, 900, 1700) + Math.min(row.metric, 30) * 6
        : scoreFromRank(row.rank, 20);
  const history = previous?.scoreHistory?.[slug] ?? [];
  const previousScore = history.at(-1);
  const fluctuationRate = row.previousRank
    ? Number((((row.previousRank - row.rank) / Math.max(row.previousRank, 1)) * 12).toFixed(2))
    : changeFromScores(score, previousScore);
  const sparkline = sparklineFromHistory(history, score);
  const volume = row.volume ?? volumeFromRank(row.rank, knownType === "music_chart" ? 120_000 : 70_000);
  const tags = [...new Set([...(catalog?.tags ?? []), ...(row.tags ?? []), ...extraTags])].slice(0, 5);
  const sourceLabel = tags[0] ?? "실시간";
  const nameEn =
    catalog?.nameEn ||
    (row.subtitle && row.subtitle.length <= 32 ? row.subtitle : title);
  return {
    id: `live-${slug}`,
    slug,
    name: catalog?.name ?? title,
    nameEn,
    type: knownType,
    rank: row.rank,
    previousRank: row.previousRank ?? row.rank,
    buzzScore: score,
    openScore: previousScore ?? Number((score / (1 + fluctuationRate / 100)).toFixed(2)),
    fluctuationRate,
    volume,
    sparkline,
    history: historyPoints(sparkline),
    tags: tags.length ? tags : [sourceLabel],
    summary: `${title}은(는) ${sourceLabel} 기준으로 ${row.rank}위입니다. 등락 ${fluctuationRate.toFixed(2)}%, 거래량 대용치는 ${volume.toLocaleString("ko-KR")}입니다.`,
    analysis: `${title} 수급은 공개 차트·시청률·뉴스 피드를 합산한 실시간 스냅샷입니다. 순위 변동은 직전 수집 대비 버즈 점수 변화이며, 상세 분석은 일일 브리핑에서 이어집니다.`,
    products: catalog?.products?.length ? catalog.products : defaultProducts(title, knownType),
  };
}

function uniqueBySlug(items: RankingEntity[]): RankingEntity[] {
  const map = new Map<string, RankingEntity>();
  for (const item of items) {
    const current = map.get(item.slug);
    if (!current || item.buzzScore > current.buzzScore) map.set(item.slug, item);
  }
  return [...map.values()];
}

function buildIndices(items: RankingEntity[]): MarketIndex[] {
  return INDEX_META.map((meta) => {
    const subset = meta.type ? items.filter((item) => item.type === meta.type) : items;
    const value = subset.length
      ? Number((subset.reduce((sum, item) => sum + item.buzzScore, 0) / subset.length).toFixed(2))
      : 1000;
    const changeRate = subset.length
      ? Number((subset.reduce((sum, item) => sum + item.fluctuationRate, 0) / subset.length).toFixed(2))
      : 0;
    return {
      id: meta.id,
      label: meta.label,
      value,
      changeRate,
      note: meta.note,
    };
  });
}

export async function composeLiveSnapshot(
  sources: SourceResult[],
  previous?: IngestSnapshot,
): Promise<Omit<IngestSnapshot, "updatedAt"> & { updatedAt?: string }> {
  const byId = (id: string) => sources.find((item) => item.id === id);
  const musicPrimary = pickPrimaryMusic(sources);
  const musicRows = takeTop(musicPrimary?.items ?? [], 50);
  const artists = artistRows(musicRows);

  const terrestrial = byId("nielsen-terrestrial")?.items ?? [];
  const cable = byId("nielsen-cable")?.items ?? [];
  const ratings = takeTop(terrestrial, 40);
  const shows = takeTop(
    cable.filter((row) => !/뉴스|뉴스데스크|뉴스광장/.test(row.title)),
    20,
  );

  const newsRows = mergeRows(
    sources.filter((item) => item.id.startsWith("news-") || item.id === "google-trends").map((item) => item.items),
  ).filter((row) => {
    const title = cleanTitle(row.title);
    if (normalizeName(title).length < 2) return false;
    if (matchCatalog(title)) return true;
    if (title.length > 18) return false;
    if (/^(속보|단독|종합|영상|포토|오늘|이유|충격|공개|연예|뉴스|실시간)$/.test(title)) return false;
    if (/예산|부동산|날씨|주가|환율|대통령|국회|선거/.test(title) && !matchCatalog(title)) return false;
    return (row.metric ?? 0) >= 1;
  });

  const boosts = await fetchNaverNewsBoost(newsRows.slice(0, 10).map((row) => row.title));
  const boostedNews = newsRows.map((row) => ({
    ...row,
    metric: (row.metric ?? 0) + Math.min((boosts.get(row.title) ?? 0) / 500, 40),
  }));

  const usedNames = [...musicRows, ...artists, ...ratings, ...shows].map((row) => row.title);
  const buzzEntities = boostedNews
    .filter((row) => !usedNames.some((name) => namesOverlap(name, row.title)))
    .map((row) => {
      const type = classifyBuzzType(row.title, row.tags ?? []);
      if (type === "music_chart") return toEntity(row, "celebrity", previous, row.tags ?? []);
      return toEntity(row, type, previous, row.tags ?? []);
    });

  const built = uniqueBySlug([
    ...musicRows.map((row) => toEntity(row, "music_chart", previous, row.tags ?? [])),
    ...artists.map((row) => toEntity(row, "kpop", previous, ["차트 아티스트"])),
    ...ratings.map((row) => toEntity(row, "tv_rating", previous, row.tags ?? [])),
    ...shows.map((row) => toEntity(row, "tv_show", previous, row.tags ?? [])),
    ...buzzEntities,
  ]);

  const items = built
    .sort((a, b) => b.buzzScore - a.buzzScore)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      previousRank: previous?.items.find((row) => row.slug === item.slug)?.rank ?? index + 1,
    }));

  const scoreHistory = { ...(previous?.scoreHistory ?? {}) };
  for (const item of items) {
    scoreHistory[item.slug] = [...(scoreHistory[item.slug] ?? []).slice(-6), item.buzzScore];
  }

  return {
    status: items.length ? "open" : "closed",
    sources: sources.map((item) => ({ id: item.id, ok: item.ok, count: item.count, error: item.error })),
    indices: buildIndices(items),
    items,
    scoreHistory,
  };
}

export function snapshotToPayload(snapshot: Pick<IngestSnapshot, "updatedAt" | "status" | "indices" | "items">): RankingsPayload {
  return {
    updatedAt: snapshot.updatedAt,
    status: snapshot.status,
    indices: snapshot.indices,
    items: snapshot.items,
  };
}
