import { chatJson, draftModel } from "@/lib/analysis/chain/llm";
import type { AnalysisLogger } from "@/lib/analysis/log";
import type { NewsDoc } from "@/lib/news/types";
import {
  AGE_SEGMENTS,
  CORE_AGE_SEGMENTS,
  applyDemographicWeights,
  dedupeSegments,
  deriveDemographics,
  GENDER_SEGMENTS,
  isUnusableRankName,
} from "@/lib/boards/demographics";
import { computeBoardIndex } from "@/lib/boards/board-index";
import { rankLimitForBoard, segmentLimitForBoard } from "@/lib/boards/limits";
import {
  ensureCultureGrantRanking,
  isCultureGrantBoard,
} from "@/lib/boards/culture-grants";
import {
  ensureTravelGrantRanking,
  isTravelGrantBoard,
} from "@/lib/boards/travel-grants";
import { boardUsesRegionFilter, ensureFoodRestaurantRanking, ensureHousingApartmentRanking, HOUSING_BOARD_SLUG, isCultureEventVenueOnly } from "@/lib/boards/regions";
import { EXHIBITION_BOARD_SLUG, PERFORMANCE_BOARD_SLUG } from "@/lib/boards/region-catalogs";
import { boardUsesKidsAgeTab } from "@/lib/boards/kids-culture";
import type {
  AgeSegment,
  BoardDefinition,
  BoardRankEntry,
  DemographicRanking,
  GenderSegment,
  RegionSegment,
} from "@/lib/boards/types";
import { canonicalizeGameEsportsName } from "@/lib/boards/game-platforms";
import { carryForwardBoardLeaders, ensureInfluencerBoardRanking } from "@/lib/politics/fail-safe";
import {
  ensureLocalPolicyRanking,
  ensurePunditRanking,
  ensureSubsidyRanking,
} from "@/lib/politics/labeled-rank";

export interface RankResult {
  ranking: BoardRankEntry[];
  demographics: DemographicRanking;
  /** False when the model skipped the segment block and it was derived instead. */
  demographicsFromLlm: boolean;
  indexValue: number;
  indexChangeRate: number;
}

/** Matches the response contract stated in the prompt. */
interface RawRank {
  name?: unknown;
  score?: unknown;
  change_rate?: unknown;
  note?: unknown;
}

interface RawResponse {
  index_value?: unknown;
  index_change_rate?: unknown;
  total_ranking?: unknown;
  demographic_ranking?: {
    gender?: Partial<Record<GenderSegment, unknown>>;
    age?: Partial<Record<AgeSegment | "70s_plus", unknown>>;
    region?: Partial<Record<RegionSegment, unknown>>;
  };
}

const SCORE_MAX = 100;

const SYSTEM = [
  "당신은 한국 트렌드 데이터를 다루는 정량 애널리스트다.",
  "제공된 뉴스 스니펫에서 언급량·검색 관심도·감성(긍정/부정) 신호를 읽어 순위와 지수를 산출한다.",
  "지수는 100점 만점 척도로 매기고, 1위가 가장 높다. 소수점 둘째 자리까지 쓴다.",
  "각 항목의 note는 20~45자 한 문장으로, 그 순위가 나온 근거를 적는다. 광고 문구를 쓰지 않는다.",
  "네이버·구글 검색 트렌드의 성별/연령 통계 특성을 반영해 세그먼트별 순위를 다르게 구성한다.",
  "세그먼트 순위는 전체 순위와 반드시 같지 않아야 하며, 해당 인구집단의 관심사 차이를 반영해 순서와 점수를 조정한다.",
  "프론트는 성별과 연령 탭을 동시에 켤 수 있다. 두 목록에 같은 이름이 겹쳐야 교차 필터가 의미를 갖는다.",
  "9개 세그먼트(남/여/10대~70대 이상)의 목록은 서로 모두 달라야 한다. 같은 목록을 두 세그먼트에 반복해 쓰지 마라.",
  "특히 30대·40대·50대·60대·70대를 같은 순서로 복사하지 마라. 연령이 올라갈수록 데뷔 연차가 오래된 대상의 비중이 커진다.",
  "아동/유치원(kids) 세그먼트가 있으면 어린이·유아·키즈·가족 관람 가능 종목만 넣고, 위키드·데스노트·시카고·아이돌 콘서트·성인 아트전은 금지다.",
  "이름은 실제 고유명사만 쓴다. '영화 A', '종목 1' 같은 플레이스홀더와 장르명(한국 상업영화 등)은 금지다.",
  "반드시 지정된 JSON 스키마만 반환한다.",
].join(" ");

function schemaHint(board: BoardDefinition): string {
  const total = rankLimitForBoard(board);
  const segment = segmentLimitForBoard(board);
  const regionBlock = boardUsesRegionFilter(board.slug)
    ? `,\n    "region": { "seoul": [ ...${segment}개 ], "busan": [ ... ], "...시/도 키": [ ... ] }`
    : "";
  const ageSchema = boardUsesKidsAgeTab(board.slug)
    ? `"kids": [ ...${segment}개 ], "10s": [ ...${segment}개 ], "20s": [ ...${segment}개 ], "30s": [ ...${segment}개 ], "40s": [ ...${segment}개 ], "50s": [ ...${segment}개 ], "60s": [ ...${segment}개 ], "70s_plus": [ ...${segment}개 ]`
    : `"10s": [ ...${segment}개 ], "20s": [ ...${segment}개 ], "30s": [ ...${segment}개 ], "40s": [ ...${segment}개 ], "50s": [ ...${segment}개 ], "60s": [ ...${segment}개 ], "70s_plus": [ ...${segment}개 ]`;
  return [
    "{",
    '  "index_value": 숫자(100점 척도 보드 종합 지수),',
    '  "index_change_rate": 숫자(직전 대비 % 변화, -15~15 범위),',
    `  "total_ranking": [ { "name": "${board.unitLabel}명", "score": 숫자, "change_rate": 숫자, "note": "문장" } × ${total} ],`,
    '  "demographic_ranking": {',
    `    "gender": { "male": [ ...${segment}개 ], "female": [ ...${segment}개 ] },`,
    `    "age": { ${ageSchema} }${regionBlock}`,
    "  }",
    "}",
  ].join("\n");
}

function cleanText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed || fallback;
}

function cleanNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toEntries(value: unknown, limit: number, unitLabel: string, boardSlug?: string): BoardRankEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows: BoardRankEntry[] = [];

  for (const raw of value as RawRank[]) {
    const cleaned = cleanText(raw?.name, "").slice(0, 80);
    const name =
      boardSlug === "game-esports-ranking" ? canonicalizeGameEsportsName(cleaned) : cleaned;
    if (!name || isUnusableRankName(name)) continue;
    if (isCultureEventVenueOnly(name, boardSlug)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const rank = rows.length + 1;
    const rawScore = cleanNumber(raw?.score, 0);
    const score = normalizeScore(rawScore, rank);

    rows.push({
      rank,
      name,
      score,
      changeRate: Number(cleanNumber(raw?.change_rate, 0).toFixed(2)),
      note: cleanText(raw?.note, `${unitLabel} 관련 언급량 기준 ${rank}위`).slice(0, 60),
    });
    if (rows.length >= limit) break;
  }

  return enforceDescending(rows);
}

function normalizeScore(raw: number, rank: number): number {
  let value = raw;
  if (value > SCORE_MAX && value <= 1000) value = value / 10;
  if (value > 0 && value <= SCORE_MAX) return Number(value.toFixed(2));
  return Number((98 - rank * 4.2).toFixed(2));
}

function enforceDescending(rows: BoardRankEntry[]): BoardRankEntry[] {
  let ceiling = Number.POSITIVE_INFINITY;
  return rows.map((row) => {
    const score = row.score >= ceiling ? Number((ceiling - 1.25).toFixed(2)) : row.score;
    ceiling = score;
    return { ...row, score: Math.max(score, 1) };
  });
}

function ensureSpecialRanking(board: BoardDefinition, rows: BoardRankEntry[]): BoardRankEntry[] {
  if (board.slug === "political-influencer-power") return ensureInfluencerBoardRanking(rows);
  if (board.slug === "governor-approval-index") return ensureLocalPolicyRanking(rows);
  if (board.slug === "government-support-fund" || board.slug === "government-subsidy-search" || board.slug === "entertainment-government-grant-ranking") {
    return ensureSubsidyRanking(rows);
  }
  if (isCultureGrantBoard(board.slug)) return ensureCultureGrantRanking(rows);
  if (isTravelGrantBoard(board.slug)) return ensureTravelGrantRanking(rows);
  if (board.slug === "political-pundit-ranking") return ensurePunditRanking(rows);
  if (board.slug === HOUSING_BOARD_SLUG) {
    return ensureHousingApartmentRanking(rows, rankLimitForBoard(board));
  }
  if (boardUsesRegionFilter(board.slug)) return ensureFoodRestaurantRanking(rows, board.seeds, board.slug);
  return rows;
}

export function rankFromSeeds(board: BoardDefinition): {
  ranking: BoardRankEntry[];
  demographics: DemographicRanking;
  indexValue: number;
  indexChangeRate: number;
} {
  const ranking = ensureSpecialRanking(board, fallbackRanking(board, []));
  const demographics = deriveDemographics(ranking, board);
  const index = computeBoardIndex(ranking, board.slug);
  return {
    ranking,
    demographics,
    indexValue: index.value,
    indexChangeRate: index.changeRate,
  };
}

function fallbackRanking(board: BoardDefinition, docs: NewsDoc[]): BoardRankEntry[] {
  const limit = rankLimitForBoard(board);
  const fromNews = docs.flatMap((doc) => {
    const title = doc.title.replace(/\s*[-|·]\s*[^-|·]+$/, "").trim();
    const quoted = [...title.matchAll(/[“"『「]([^”"』」]{2,40})[”"』」]/g)].map((match) => match[1]);
    return [title, ...quoted];
  }).filter((title) => title.length >= 2 && title.length <= 40 && !isUnusableRankName(title));
  const names = [...board.seeds, ...fromNews].map((name) =>
    board.slug === "game-esports-ranking" ? canonicalizeGameEsportsName(name) : name,
  );
  const unique: string[] = [];
  for (const name of names) {
    if (!unique.some((item) => item === name) && !isUnusableRankName(name)) unique.push(name);
    if (unique.length >= limit) break;
  }

  return unique.map((name, index) => ({
    rank: index + 1,
    name,
    score: Number(Math.max(12, 96 - index * (80 / Math.max(limit - 1, 1))).toFixed(2)),
    changeRate: Number((((index % 5) - 2) * 1.35).toFixed(2)),
    note: `${board.criteria} 기준 ${index + 1}위`,
  }));
}

function parseDemographics(
  raw: RawResponse["demographic_ranking"],
  board: BoardDefinition,
): { value: DemographicRanking; complete: boolean } {
  const gender = {} as Record<GenderSegment, BoardRankEntry[]>;
  const age = {} as Record<AgeSegment, BoardRankEntry[]>;
  let filled = 0;
  const limit = segmentLimitForBoard(board);

  for (const key of GENDER_SEGMENTS) {
    const rows = toEntries(raw?.gender?.[key], limit, board.unitLabel, board.slug);
    gender[key] = rows;
    if (rows.length) filled += 1;
  }
  const ageBlock = raw?.age as Record<string, unknown> | undefined;
  const requiredAges = boardUsesKidsAgeTab(board.slug) ? AGE_SEGMENTS : CORE_AGE_SEGMENTS;
  for (const key of AGE_SEGMENTS) {
    const source = key === "70s" ? (ageBlock?.["70s_plus"] ?? ageBlock?.["70s"]) : ageBlock?.[key];
    const rows = toEntries(source, limit, board.unitLabel, board.slug);
    age[key] = rows;
    if (requiredAges.includes(key) && rows.length) filled += 1;
  }

  return {
    value: { gender, age },
    complete: filled === GENDER_SEGMENTS.length + requiredAges.length,
  };
}

function padRanking(
  rows: BoardRankEntry[],
  board: BoardDefinition,
  docs: NewsDoc[],
): BoardRankEntry[] {
  const limit = rankLimitForBoard(board);
  const seeded = ensureSpecialRanking(board, rows);
  if (seeded.length >= limit) return seeded.slice(0, limit);
  const seen = new Set(seeded.map((row) => row.name));
  const extras = fallbackRanking(board, docs).filter((row) => !seen.has(row.name));
  return [...seeded, ...extras].slice(0, limit).map((row, index) => ({ ...row, rank: index + 1 }));
}

function mergeTicketChartSeeds(
  rows: BoardRankEntry[],
  ticketSeeds: string[],
  board: BoardDefinition,
): BoardRankEntry[] {
  if (!ticketSeeds.length) return rows;
  if (board.slug !== PERFORMANCE_BOARD_SLUG && board.slug !== EXHIBITION_BOARD_SLUG) return rows;
  const boosted: BoardRankEntry[] = ticketSeeds.slice(0, rankLimitForBoard(board)).map((name, index) => ({
    rank: index + 1,
    name,
    score: Number((97.5 - index * 1.05).toFixed(2)),
    changeRate: Number((((index % 5) - 2) * 0.9).toFixed(2)),
    note: "티켓몰 예매 순위 반영",
  }));
  const seen = new Set(boosted.map((row) => row.name.replace(/\s+/g, "").toLowerCase()));
  for (const row of rows) {
    const key = (row.name ?? "").replace(/\s+/g, "").toLowerCase();
    if (!key || seen.has(key) || isCultureEventVenueOnly(row.name, board.slug)) continue;
    seen.add(key);
    boosted.push(row);
  }
  return enforceDescending(
    boosted.slice(0, rankLimitForBoard(board)).map((row, index) => ({ ...row, rank: index + 1 })),
  );
}

/**
 * Step 1 — turn retrieved coverage into a ranked board with demographic slices.
 * Always resolves: a missing key or a malformed response falls back to seeds so
 * the board renders rather than 404ing.
 */
export async function rankBoard(input: {
  board: BoardDefinition;
  docs: NewsDoc[];
  logger: AnalysisLogger;
  timeoutMs?: number;
  previousRanking?: BoardRankEntry[];
  /** NOL 인터파크·예스24 등 티켓몰 공개 예매 순위 라인. */
  ticketChartLines?: string[];
  /** `[지역] 공연/행사명` 씨드 — 랭킹 상단에 우선 반영. */
  ticketSeeds?: string[];
}): Promise<RankResult> {
  const { board, docs, logger } = input;
  const totalN = rankLimitForBoard(board);
  const segmentN = segmentLimitForBoard(board);

  const context = docs
    .slice(0, 16)
    .map((doc, index) => `${index + 1}. [${doc.publisher ?? "출처미상"}] ${doc.title} — ${doc.snippet ?? ""}`)
    .join("\n");

  const ticketBlock = input.ticketChartLines?.length
    ? [
        "티켓몰 예매 순위(NOL 인터파크·예스24·티켓링크·KOPIS 공개 랭킹):",
        ...input.ticketChartLines,
        "위 예매 순위를 최우선 근거로 삼아 실제 공연명/행사명 랭킹을 구성하라. 공연장·미술관·몰 이름만 단독으로 올리지 마라.",
      ].join("\n")
    : "";

  const user = [
    `보드: ${board.title}`,
    `산출 기준: ${board.criteria}`,
    `랭킹 단위: ${board.unitLabel}`,
    `참고 키워드: ${board.queries.join(", ")}`,
    board.rankGuidance ? `추가 규칙: ${board.rankGuidance}` : "",
    boardUsesRegionFilter(board.slug)
      ? "지역 메타: 각 name은 `[시/도] 상호/음식` 형식이며, demographic_ranking.region에 시/도별 목록을 넣는다. 시/도 키는 seoul,gyeonggi,incheon,busan,daegu,gwangju,daejeon,ulsan,sejong,gangwon,chungbuk,chungnam,jeonbuk,jeonnam,gyeongbuk,gyeongnam,jeju 이다."
      : "",
    "",
    ticketBlock,
    context ? `수집된 최신 보도:\n${context}` : ticketBlock ? "" : "수집된 보도가 없다. 통상적인 한국 시장 상황을 근거로 추정하라.",
    "",
    `전체 1~${totalN}위와 성별(남/여) · 연령(${boardUsesKidsAgeTab(board.slug) ? "아동/유치원·" : ""}10대~70대 이상, JSON 키 ${boardUsesKidsAgeTab(board.slug) ? "kids·" : ""}70s_plus)${boardUsesRegionFilter(board.slug) ? " · 지역(시/도)" : ""} 각 1~${segmentN}위를 아래 JSON 스키마로 반환하라.\n${schemaHint(board)}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const parsed = await chatJson<RawResponse>({
    system: SYSTEM,
    user,
    temperature: 0.5,
    timeoutMs: input.timeoutMs ?? 45_000,
    logger,
    step: "board:rank",
    model: draftModel(),
  });

  const llmRanking = toEntries(parsed?.total_ranking, totalN, board.unitLabel, board.slug);
  const withTickets = mergeTicketChartSeeds(llmRanking, input.ticketSeeds ?? [], board);
  const padded = padRanking(
    withTickets.length >= 5 ? withTickets : fallbackRanking(board, docs),
    board,
    docs,
  );
  const ranking =
    board.slug === "political-influencer-power"
      ? carryForwardBoardLeaders(padded, input.previousRanking)
      : padded;

  const demo = parseDemographics(parsed?.demographic_ranking, board);
  const deduped = demo.complete
    ? dedupeSegments(demo.value, ranking, segmentN)
    : { value: deriveDemographics(ranking, board), replaced: [] };
  const demographics = applyDemographicWeights(board, ranking, deduped.value);

  logger.step("board:demographics", {
    source: demo.complete ? "llm" : "derived",
    gender: GENDER_SEGMENTS.map((key) => `${key}:${demographics.gender[key]?.length ?? 0}`).join(","),
    age: AGE_SEGMENTS.map((key) => `${key}:${demographics.age[key]?.length ?? 0}`).join(","),
    deduped: deduped.replaced.length ? deduped.replaced.join(",") : undefined,
  });

  const average = ranking.reduce((sum, row) => sum + row.score, 0) / (ranking.length || 1);
  const indexValue = normalizeScore(cleanNumber(parsed?.index_value, average), 1);
  const rawChange = cleanNumber(parsed?.index_change_rate, 0);
  const indexChangeRate = Number(Math.max(-15, Math.min(15, rawChange)).toFixed(2));

  return {
    ranking,
    demographics,
    demographicsFromLlm: demo.complete,
    indexValue,
    indexChangeRate,
  };
}
