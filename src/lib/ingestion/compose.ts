import { matchCatalog } from "@/lib/ingestion/catalog";
import {
  matchTrafficChannel,
  TOP_TRAFFIC_CHANNELS_WHITELIST,
  type TrafficChannel,
} from "@/lib/ingestion/channels";
import { classifySmart, type SmartClassification } from "@/lib/ingestion/classify";
import { ingestLog } from "@/lib/ingestion/log";
import { namesOverlap, normalizeName, slugify } from "@/lib/ingestion/names";
import {
  changeFromScores,
  pointsFromRate,
  scoreFromMetric,
  scoreFromRank,
  sparklineFromHistory,
  volumeFromRank,
} from "@/lib/ingestion/score";
import { classifyBuzzType, fetchNaverNewsBoost } from "@/lib/ingestion/sources/buzz";
import { pickConsoleGames, pickMobileGames, pickPcGames } from "@/lib/ingestion/sources/games";
import { pickPrimaryMusic } from "@/lib/ingestion/sources/music";
import { pickPrimaryMovie } from "@/lib/ingestion/sources/movies";
import { pickPrimaryShorts } from "@/lib/ingestion/sources/shorts";
import { pickPrimaryWebtoon } from "@/lib/ingestion/sources/webtoon";
import { attachTimeframeMetrics, changeForEntity, volumeForTimeframe } from "@/lib/timeframes";
import type {
  CatalogMatch,
  ChartRow,
  IngestSnapshot,
  MeasurementPoint,
  SourceResult,
} from "@/lib/ingestion/types";
import { matchPoliticsCatalog } from "@/lib/politics/catalog";
import { composePoliticsEntities } from "@/lib/politics/compose";
import { isPoliticsEntityType, POLITICS_INDEX_META } from "@/lib/politics/types";
import type { AffiliateProduct, EntityType, MarketIndex, RankingEntity, RankingsPayload } from "@/lib/types";

/**
 * How many observations to keep per slug. Sources refresh on their own cadence
 * (Nielsen daily, Steam continuously), so this is a count of distinct values
 * rather than a fixed span of time.
 */
const MEASUREMENT_HISTORY_LIMIT = 60;

const INDEX_META: { id: string; label: string; type?: EntityType; note: string }[] = [
  { id: "k-buzz", label: "KindexLab 종합", note: "정치 지지도·검색량·이슈 합산" },
  { id: "kpop", label: "K-POP지수", type: "kpop", note: "차트 아티스트 수급" },
  { id: "broadcast", label: "방송지수", type: "tv_show", note: "편성·화제 합산" },
  { id: "celebrity", label: "셀럽지수", type: "celebrity", note: "검색·뉴스 버즈" },
  { id: "influencer", label: "인플지수", type: "influencer", note: "크리에이터 언급" },
  { id: "music", label: "음원지수", type: "music_chart", note: "멜론·지니·스포티파이·유튜브 뮤직 복합" },
  { id: "ratings", label: "시청률지수", type: "tv_rating", note: "닐슨 가구 시청률" },
  { id: "movie", label: "영화지수", type: "movie", note: "KOBIS 박스오피스·포털 영화 순위" },
  { id: "webtoon", label: "웹툰지수", type: "webtoon", note: "네이버·카카오 인기" },
  { id: "shorts", label: "숏폼지수", type: "shorts", note: "유튜브·숏폼 조회" },
  { id: "mobile", label: "모바일지수", type: "mobile_game", note: "앱스토어 게임 인기" },
  { id: "pcgame", label: "PC게임지수", type: "pc_game", note: "스팀 동접·플레이타임" },
  { id: "console", label: "콘솔지수", type: "console_game", note: "콘솔 트렌드 순위" },
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
      : type === "movie"
        ? [`${name} 블루레이`, "팝콘", "홈시네마 프로젝터"]
      : type === "tv_show" || type === "tv_rating"
        ? [`${name} 굿즈`, "홈시네마 프로젝터", "팝콘"]
        : type === "webtoon"
          ? [`${name} 단행본`, `${name} 굿즈`, "태블릿"]
          : type === "shorts"
            ? [`${name} 관련 굿즈`, "스마트폰 거치대", "무선 이어폰"]
            : type === "mobile_game" || type === "pc_game" || type === "console_game"
              ? [`${name} 가이드북`, "게이밍 헤드셋", "컨트롤러"]
              : isPoliticsEntityType(type)
                ? type === "subsidy"
                  ? [`${name}`, "가계부", "적금"]
                  : [`${name} 시사 도서`, "정부 지원금", "노트북"]
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

/**
 * Percent change against the last stored observation of the same quantity.
 *
 * Unlike the rank-derived rate this compares like with like — 8.4% against
 * yesterday's 8.1% — so it is the only change figure on the entity that can be
 * stated as fact. Returns undefined on the first sighting, when there is
 * genuinely nothing to compare against.
 */
function measuredChange(points: MeasurementPoint[] | undefined, value: number): number | undefined {
  const last = points?.at(-1)?.v;
  if (last === undefined || last <= 0) return undefined;
  return Number((((value - last) / last) * 100).toFixed(2));
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

function scaledVolume(views: number | undefined, rank: number, divisor: number, fallback = 90_000): number {
  if (!views || views <= 0) return volumeFromRank(rank, fallback);
  return Math.max(70_000, Math.min(Math.round(views / divisor), 4_800_000));
}

function shortsVolume(views: number | undefined, rank: number): number {
  const ranked = volumeFromRank(rank, 110_000);
  if (!views || views <= 0) return ranked;
  return Math.max(ranked, Math.min(Math.round(views / 4), 4_800_000));
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
  lockType = false,
  /**
   * How many rows the source returned. Passing the real length matters: the
   * band was previously divided by a hardcoded 20 or 40, so a 48-row feed piled
   * everything past that point onto the floor and a 12-row feed used only a
   * sliver of the range. Both produce ties, and tied rows never reorder.
   */
  listSize?: number,
): RankingEntity {
  const title = cleanTitle(row.title);
  const catalog: CatalogMatch | undefined = matchCatalog(title, row.subtitle);
  const chartLocked =
    lockType ||
    type === "shorts" ||
    type === "webtoon" ||
    type === "movie" ||
    type === "music_chart" ||
    type === "mobile_game" ||
    type === "pc_game" ||
    type === "console_game" ||
    isPoliticsEntityType(type);
  const knownType = chartLocked ? type : (catalog?.type ?? type);
  const slug =
    type === "shorts"
      ? `shorts-${slugify(title) || catalog?.slug || `item-${row.rank}`}`
      : (catalog?.slug ?? slugify(title));
  const span = listSize && listSize > 1 ? listSize : 20;
  const score =
    row.metric && type === "tv_rating"
      ? scoreFromMetric(row.metric)
      : row.metric &&
          (type === "webtoon" ||
            type === "shorts" ||
            type === "movie" ||
            type === "mobile_game" ||
            type === "pc_game" ||
            type === "console_game")
        ? scoreFromRank(row.rank, span, 900, 1860) + Math.min(Math.max(row.metric, 0), 12) * 8
        : row.metric && (type === "celebrity" || type === "influencer")
          ? scoreFromRank(row.rank, span, 900, 1700) + Math.min(row.metric, 30) * 6
          : scoreFromRank(row.rank, span);
  const history = previous?.scoreHistory?.[slug] ?? [];
  const previousScore = history.at(-1);
  const measurement = row.measurement
    ? {
        ...row.measurement,
        observedAt: new Date().toISOString(),
        changeRate: measuredChange(previous?.measurementHistory?.[slug], row.measurement.value),
      }
    : undefined;
  const fluctuationRate = row.previousRank
    ? Number((((row.previousRank - row.rank) / Math.max(row.previousRank, 1)) * 12).toFixed(2))
    : changeFromScores(score, previousScore);
  const sparkline = sparklineFromHistory(history, score);
  const volume =
    knownType === "webtoon"
      ? scaledVolume(row.volume, row.rank, 35, 95_000)
      : knownType === "shorts"
        ? shortsVolume(row.volume, row.rank)
        : knownType === "pc_game"
          ? scaledVolume(row.volume, row.rank, 4, 100_000)
        : knownType === "movie"
          ? scaledVolume(row.volume, row.rank, 8, 95_000)
          : knownType === "mobile_game" || knownType === "console_game"
            ? (row.volume ?? volumeFromRank(row.rank, 88_000))
            : (row.volume ??
              volumeFromRank(row.rank, knownType === "music_chart" ? 120_000 : 70_000));
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
    measurement,
    volume,
    sparkline,
    history: historyPoints(sparkline),
    tags: tags.length ? tags : [sourceLabel],
    summary: `${title}은(는) ${sourceLabel} 기준으로 ${row.rank}위입니다. 등락 ${fluctuationRate.toFixed(2)}%, 거래량 대용치는 ${volume.toLocaleString("ko-KR")}입니다.`,
    analysis: `${title} 수급은 공개 차트·시청률·웹툰 인기·숏폼 조회·게임 순위·뉴스 피드를 합산한 실시간 스냅샷입니다. 순위 변동은 직전 수집 대비 버즈 점수 변화이며, 상세 분석은 일일 브리핑에서 이어집니다.`,
    products: catalog?.products?.length ? catalog.products : defaultProducts(title, knownType),
    imageUrl: row.imageUrl,
  };
}

interface PromotedRow {
  row: ChartRow;
  type: EntityType;
  channel?: TrafficChannel;
}

/**
 * Decides the category of a trend row from its own text instead of trusting the
 * feed it arrived on. YouTube trending is a single undifferentiated list, so
 * without this every political talk show and web-variety clip was filed as 숏폼
 * and never reached the politics or entertainment surfaces.
 */
function promoteTrendRow(row: ChartRow, fallback: EntityType): PromotedRow {
  const title = cleanTitle(row.title);
  const channel = matchTrafficChannel(title, row.subtitle);

  if (channel) {
    ingestLog("whitelist", {
      channel: channel.name,
      category: channel.category,
      type: channel.type,
      via: row.subtitle || title,
    });
    return {
      // A feed row is one episode. The entity is the channel itself, which is
      // what readers search and what a news query can actually resolve.
      row: {
        ...row,
        title: channel.name,
        tags: [...new Set([...(row.tags ?? []), ...channel.tags])],
      },
      type: channel.type,
      channel,
    };
  }

  const smart = classifySmart(title, row.subtitle, row.tags ?? []);
  if (smart && shouldRetag(fallback, smart)) {
    ingestLog("retag", {
      title,
      from: fallback,
      to: smart.type,
      category: smart.category,
      matched: smart.matched,
      via: smart.source,
      strength: smart.strength,
    });
    return {
      row: { ...row, tags: [...new Set([...(row.tags ?? []), smart.matched])] },
      type: smart.type,
    };
  }

  return { row, type: fallback };
}

/**
 * Culture types that already place a row correctly on the entertainment side.
 * A drama is not improved by being relabelled an influencer.
 */
const ENTERTAINMENT_FAMILY = new Set<EntityType>([
  "tv_show",
  "kpop",
  "celebrity",
  "influencer",
  "music_chart",
  "tv_rating",
  "movie",
  "webtoon",
]);

/**
 * Re-tagging is only worth doing when it moves a row to a category it is not
 * already in. Without this gate the entertainment rule rewrote every drama and
 * chart artist as an influencer, and a genre tag on a source batch was enough
 * to file a period drama under politics because its tags mentioned 대통령.
 */
function shouldRetag(fallback: EntityType, smart: SmartClassification): boolean {
  if (smart.category === "politics") {
    // News/media talk shows still belong on the 정치 유튜브 heatmap.
    if (smart.type === "political_influencer" && fallback !== "political_influencer") {
      return smart.strength === "strong" && smart.source === "text";
    }
    if (isPoliticsEntityType(fallback)) return false;
    // Crossing into politics discards a working culture classification, so it
    // needs the term in the row's own title, not in a shared genre tag.
    return smart.strength === "strong" && smart.source === "text";
  }
  // Entertainment rules exist to rescue rows with no real category yet.
  return !ENTERTAINMENT_FAMILY.has(fallback) && !isPoliticsEntityType(fallback);
}

/**
 * Rank given to a whitelisted channel the trending feed did not return today.
 * These channels carry the audience the site publishes for, so they are seeded
 * at the top of their batch and interleave with the live charts rather than
 * settling into the tail where nothing reaches them.
 */
const WHITELIST_BASE_RANK = 1;

/** Rows for whitelisted channels missing from every live source. */
function missingWhitelistRows(seen: string[]): ChartRow[] {
  return TOP_TRAFFIC_CHANNELS_WHITELIST.filter(
    (channel) =>
      !seen.some(
        (name) =>
          namesOverlap(name, channel.name) ||
          channel.aliases.some((alias) => namesOverlap(alias, name)),
      ),
  ).map((channel, index) => ({
    rank: WHITELIST_BASE_RANK + index,
    title: channel.name,
    subtitle: channel.category === "politics" ? "시사 채널" : "웹예능 채널",
    tags: [...channel.tags, "화이트리스트"],
  }));
}

function uniqueBySlug(items: RankingEntity[]): RankingEntity[] {
  const map = new Map<string, RankingEntity>();
  for (const item of items) {
    const current = map.get(item.slug);
    if (!current || item.buzzScore > current.buzzScore) map.set(item.slug, item);
  }
  return [...map.values()];
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sparklineChange(item: RankingEntity): number {
  const series = item.sparkline.filter((value) => Number.isFinite(value));
  if (series.length < 2) return 0;
  return changeFromScores(series[series.length - 1] ?? 0, series[0]);
}

function weightedWindowChange(items: RankingEntity[]): number {
  const leaders = [...items]
    .sort((a, b) => volumeForTimeframe(b, "1d") - volumeForTimeframe(a, "1d") || a.rank - b.rank)
    .slice(0, 12);
  let weighted = 0;
  let mass = 0;
  for (const item of leaders) {
    const weight = Math.sqrt(Math.max(volumeForTimeframe(item, "1d"), 1));
    weighted += changeForEntity(item, "1d") * weight;
    mass += weight;
  }
  return mass > 0 ? Number((weighted / mass).toFixed(2)) : 0;
}

function pickIndexChange(candidates: number[]): number {
  const finite = candidates.filter((value) => Number.isFinite(value));
  const strong = finite.find((value) => Math.abs(value) >= 0.5 && Math.abs(value) <= 18);
  if (strong != null) return Number(strong.toFixed(2));
  const modest = [...finite]
    .filter((value) => Math.abs(value) >= 0.05 && Math.abs(value) <= 18)
    .sort((a, b) => Math.abs(b) - Math.abs(a));
  if (modest[0] != null) return Number(modest[0].toFixed(2));
  const fallback = finite.find((value) => Math.abs(value) >= 0.05) ?? 0;
  return Number(Math.max(-18, Math.min(18, fallback)).toFixed(2));
}

function entityIndexChange(item: RankingEntity): number {
  const live = changeForEntity(item, "1d");
  if (Number.isFinite(live) && live !== 0) return live;
  if (Number.isFinite(item.fluctuationRate) && item.fluctuationRate !== 0) return item.fluctuationRate;
  return changeFromScores(item.buzzScore, item.openScore);
}

function directedSectorChange(items: RankingEntity[]): number {
  if (!items.length) return 0;
  const ranked = [...items].sort(
    (a, b) =>
      volumeForTimeframe(b, "1d") - volumeForTimeframe(a, "1d") ||
      a.rank - b.rank,
  );
  const leaders = ranked.slice(0, Math.max(3, Math.ceil(ranked.length * 0.4)));
  return mean(leaders.map(entityIndexChange));
}

export function buildIndices(
  items: RankingEntity[],
  previous?: MarketIndex[],
  metas: { id: string; label: string; type?: EntityType; note: string }[] = INDEX_META,
): MarketIndex[] {
  return metas.map((meta) => {
    const subset = (meta.type ? items.filter((item) => item.type === meta.type) : items).map(
      attachTimeframeMetrics,
    );
    const value = subset.length
      ? Number((subset.reduce((sum, item) => sum + item.buzzScore, 0) / subset.length).toFixed(2))
      : 1000;
    const vsPrevious = changeFromScores(
      value,
      previous?.find((index) => index.id === meta.id)?.value,
    );
    const stored = subset.length ? mean(subset.map(entityIndexChange)) : 0;
    const vsOpen = subset.length
      ? mean(subset.map((item) => changeFromScores(item.buzzScore, item.openScore)))
      : 0;
    const spark = subset.length ? mean(subset.map(sparklineChange)) : 0;
    const windowed = subset.length ? weightedWindowChange(subset) : 0;
    const directed = subset.length ? directedSectorChange(subset) : 0;
    const changeRate = pickIndexChange([vsPrevious, stored, directed, windowed, vsOpen, spark]);
    return {
      id: meta.id,
      label: meta.label,
      value,
      changeRate,
      changePoints: pointsFromRate(value, changeRate),
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
  const moviePrimary = pickPrimaryMovie(sources);
  const movieRows = takeTop(moviePrimary?.items ?? [], 30);
  const webtoonPrimary = pickPrimaryWebtoon(sources);
  const webtoonDaily = takeTop(byId("naver-webtoon-daily")?.items ?? webtoonPrimary?.items ?? [], 40);
  const webtoonWeekly = takeTop(byId("naver-webtoon-weekly")?.items ?? [], 50);
  const kakaoWebtoon = takeTop(byId("kakao-webtoon")?.items ?? [], 30);
  const webtoonRows = takeTop(mergeRows([webtoonDaily, webtoonWeekly, kakaoWebtoon]), 40);
  const shortsRows = takeTop(pickPrimaryShorts(sources)?.items ?? [], 30);
  const mobileRows = takeTop(mergeRows([pickMobileGames(sources)]), 30);
  const pcRows = takeTop(
    pickPcGames(sources).filter((row) => !/^Steam \d+$/i.test(row.title)),
    30,
  );
  const consoleRows = takeTop(pickConsoleGames(sources), 24);

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
    if (matchPoliticsCatalog(title).length) return false;
    return (row.metric ?? 0) >= 1;
  });

  const boosts = await fetchNaverNewsBoost(newsRows.slice(0, 10).map((row) => row.title));
  const boostedNews = newsRows.map((row) => ({
    ...row,
    metric: (row.metric ?? 0) + Math.min((boosts.get(row.title) ?? 0) / 500, 40),
  }));

  const usedNames = [
    ...musicRows,
    ...artists,
    ...ratings,
    ...shows,
    ...movieRows,
    ...webtoonRows,
    ...shortsRows,
    ...mobileRows,
    ...pcRows,
    ...consoleRows,
  ].map((row) => row.title);
  const chartTypes = new Set([
    "music_chart",
    "movie",
    "webtoon",
    "shorts",
    "mobile_game",
    "pc_game",
    "console_game",
  ]);
  const buzzEntities = boostedNews
    .filter((row) => !usedNames.some((name) => namesOverlap(name, row.title)))
    .map((row) => {
      const guess = classifyBuzzType(row.title, row.tags ?? []);
      // Chart types are owned by their own source, so a news row landing on one
      // would double-count the same subject.
      const fallback: EntityType = chartTypes.has(guess) ? "celebrity" : guess;
      const promoted = promoteTrendRow(row, fallback);
      return toEntity(
        promoted.row,
        promoted.type,
        previous,
        promoted.row.tags ?? [],
        Boolean(promoted.channel),
      );
    });

  // Shorts rows are re-tagged rather than filed wholesale as 숏폼, and any
  // whitelisted channel the feed missed is added so the two categories are
  // never empty.
  const promotedShorts = shortsRows.map((row) => promoteTrendRow(row, "shorts"));
  const seenNames = [...usedNames, ...promotedShorts.map((item) => item.row.title)];
  const whitelistFill = missingWhitelistRows(seenNames).map((row) =>
    promoteTrendRow(row, "influencer"),
  );
  const trafficRows = [...promotedShorts, ...whitelistFill];

  ingestLog("category-map", {
    shortsIn: shortsRows.length,
    promoted: trafficRows.filter((item) => item.type !== "shorts").length,
    whitelistSeen: promotedShorts.filter((item) => item.channel).length,
    whitelistFilled: whitelistFill.length,
    stillShorts: trafficRows.filter((item) => item.type === "shorts").length,
  });

  const built = uniqueBySlug([
    ...musicRows.map((row, _i, all) => toEntity(row, "music_chart", previous, row.tags ?? [], false, all.length)),
    ...artists.map((row, _i, all) => toEntity(row, "kpop", previous, ["차트 아티스트"], false, all.length)),
    ...ratings.map((row, _i, all) => toEntity(row, "tv_rating", previous, row.tags ?? [], false, all.length)),
    ...shows.map((row, _i, all) => toEntity(row, "tv_show", previous, row.tags ?? [], false, all.length)),
    ...movieRows.map((row, _i, all) => toEntity(row, "movie", previous, row.tags ?? [], true, all.length)),
    ...webtoonRows.map((row, _i, all) => toEntity(row, "webtoon", previous, row.tags ?? [], false, all.length)),
    ...trafficRows.map((item, _i, all) =>
      toEntity(item.row, item.type, previous, item.row.tags ?? [], Boolean(item.channel), all.length),
    ),
    ...mobileRows.map((row, _i, all) => toEntity(row, "mobile_game", previous, row.tags ?? [], false, all.length)),
    ...pcRows.map((row, _i, all) => toEntity(row, "pc_game", previous, row.tags ?? [], false, all.length)),
    ...consoleRows.map((row, _i, all) => toEntity(row, "console_game", previous, row.tags ?? [], false, all.length)),
    ...buzzEntities,
    ...composePoliticsEntities(sources, previous),
  ]);

  const items = built
    // Score alone leaves large tied blocks, and a stable sort freezes those in
    // source order however the underlying numbers move. Volume breaks the tie
    // on something measured — views, concurrents, viewers — so a tied group
    // still reorders when its traffic does.
    .sort((a, b) => b.buzzScore - a.buzzScore || b.volume - a.volume)
    .map((item, index) => {
      const rank = index + 1;
      const prev = previous?.items.find((row) => row.slug === item.slug);
      const previousRank = prev?.rank ?? rank;
      const scoreDelta =
        prev && prev.buzzScore > 0 ? changeFromScores(item.buzzScore, prev.buzzScore) : 0;
      const fluctuationRate = scoreDelta !== 0 ? scoreDelta : item.fluctuationRate;
      return { ...item, rank, previousRank, fluctuationRate };
    });

  const scoreHistory = { ...(previous?.scoreHistory ?? {}) };
  for (const item of items) {
    scoreHistory[item.slug] = [...(scoreHistory[item.slug] ?? []).slice(-6), item.buzzScore];
  }

  // Observations accumulate on their own track. Ingest runs every five minutes
  // but most sources refresh far slower, so an unchanged value is not recorded
  // twice -- otherwise the series would fill with repeats and a real move would
  // be pushed out of the window by them.
  const measurementHistory = { ...(previous?.measurementHistory ?? {}) };
  for (const item of items) {
    if (!item.measurement) continue;
    const points = measurementHistory[item.slug] ?? [];
    if (points.at(-1)?.v === item.measurement.value) continue;
    measurementHistory[item.slug] = [
      ...points.slice(-(MEASUREMENT_HISTORY_LIMIT - 1)),
      { t: item.measurement.observedAt ?? new Date().toISOString(), v: item.measurement.value },
    ];
  }

  return {
    status: items.length ? "open" : "closed",
    sources: sources.map((item) => ({ id: item.id, ok: item.ok, count: item.count, error: item.error })),
    indices: [
      ...buildIndices(
        items.filter((item) => !isPoliticsEntityType(item.type)),
        previous?.indices,
      ),
      ...buildIndices(
        items.filter((item) => isPoliticsEntityType(item.type)),
        previous?.indices,
        POLITICS_INDEX_META,
      ),
    ],
    items,
    scoreHistory,
    measurementHistory,
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
