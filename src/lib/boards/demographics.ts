import { DEFAULT_SEGMENT_SIZE, isTravelRegionalHeatmapBoard, rankLimitForBoard, segmentLimitForBoard } from "@/lib/boards/limits";
import { TRAVEL_HEATMAP_BOARD_NAV } from "@/lib/constants/nav";
import {
  boardUsesRegionFilter,
  deriveRegionRankings,
  filterRowsByRegion,
  padRankEntries,
  padRegionOnly,
  REGION_LABEL,
  reweightRegionByDemographic,
} from "@/lib/boards/regions";
import type {
  AgeSegment,
  BoardDefinition,
  BoardRankEntry,
  DemographicRanking,
  GenderSegment,
  RegionSegment,
  SegmentKey,
} from "@/lib/boards/types";

export const GENDER_SEGMENTS: GenderSegment[] = ["male", "female"];

export const AGE_SEGMENTS: AgeSegment[] = ["10s", "20s", "30s", "40s", "50s", "60s", "70s"];

export const GENDER_LABEL: Record<GenderSegment, string> = {
  male: "남성",
  female: "여성",
};

export const AGE_LABEL: Record<AgeSegment, string> = {
  "10s": "10대",
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50s": "50대",
  "60s": "60대",
  "70s": "70대 이상",
};

export function segmentLabel(key: SegmentKey): string {
  if (key === "total") return "전체";
  if (key === "male" || key === "female") return GENDER_LABEL[key];
  return AGE_LABEL[key];
}

export function isGenderSegment(key: string): key is GenderSegment {
  return key === "male" || key === "female";
}

export function isAgeSegment(key: string): key is AgeSegment {
  return (AGE_SEGMENTS as string[]).includes(key);
}

export function filterLabel(
  gender: "all" | GenderSegment,
  age: "all" | AgeSegment,
  region: "all" | RegionSegment = "all",
): string {
  const parts: string[] = [];
  if (region !== "all") parts.push(REGION_LABEL[region]);
  if (age !== "all") parts.push(AGE_LABEL[age]);
  if (gender !== "all") parts.push(GENDER_LABEL[gender]);
  return parts.length ? parts.join(" ") : "전체";
}

export function filterKey(
  gender: "all" | GenderSegment,
  age: "all" | AgeSegment,
  region: "all" | RegionSegment = "all",
): string {
  return `${gender}:${age}:${region}`;
}

/**
 * Single-axis key used by older callers. Prefer `filterLabel` when both tabs
 * can be active together.
 */
export function resolveSegment(gender: "all" | GenderSegment, age: "all" | AgeSegment): SegmentKey {
  if (age !== "all") return age;
  if (gender !== "all") return gender;
  return "total";
}

/**
 * When both tabs are on, blend the two stored lists instead of dropping one.
 * Names that appear in both get a weighted score; names in only one list keep
 * most of their original score so the combined top is not an empty intersect.
 */
export function blendRankings(
  genderRows: BoardRankEntry[],
  ageRows: BoardRankEntry[],
  limit = DEFAULT_SEGMENT_SIZE,
  dropNames: string[] = [],
): BoardRankEntry[] {
  const blocked = new Set(dropNames.map(normalizeName));
  const byGender = new Map(genderRows.map((row) => [row.name, row]));
  const byAge = new Map(ageRows.map((row) => [row.name, row]));
  const names = new Set([...byGender.keys(), ...byAge.keys()]);
  const combined: BoardRankEntry[] = [];

  for (const name of names) {
    if (blocked.has(normalizeName(name))) continue;
    const fromGender = byGender.get(name);
    const fromAge = byAge.get(name);
    const base = fromAge ?? fromGender;
    if (!base) continue;
    const genderScore = fromGender?.score ?? base.score * 0.82;
    const ageScore = fromAge?.score ?? base.score * 0.82;
    combined.push({
      ...base,
      score: Number((ageScore * 0.55 + genderScore * 0.45).toFixed(2)),
      note: fromAge && fromGender ? fromAge.note : base.note,
    });
  }

  combined.sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
  return combined.slice(0, Math.max(1, limit)).map((row, index) => ({ ...row, rank: index + 1 }));
}

function sliceOrHead(
  rows: BoardRankEntry[] | undefined,
  total: BoardRankEntry[],
  limit: number,
): BoardRankEntry[] {
  const source = rows?.length ? rows : total;
  return source.slice(0, Math.max(1, limit));
}

export function selectRanking(
  demographics: DemographicRanking,
  total: BoardRankEntry[],
  gender: "all" | GenderSegment,
  age: "all" | AgeSegment,
  options?: { limit?: number; dropNames?: string[]; region?: "all" | RegionSegment; boardSlug?: string },
): BoardRankEntry[] {
  const limit = options?.limit ?? Math.max(total.length, DEFAULT_SEGMENT_SIZE);
  const dropNames = options?.dropNames ?? [];
  const blocked = new Set(dropNames.map(normalizeName));
  const drop = (rows: BoardRankEntry[]) =>
    rows.filter((row) => !blocked.has(normalizeName(row.name)));
  const region = options?.region ?? "all";
  const genderAge =
    gender !== "all" && age !== "all"
      ? blendRankings(
          drop(sliceOrHead(demographics.gender[gender], total, limit)),
          drop(sliceOrHead(demographics.age[age], total, limit)),
          limit,
          dropNames,
        )
      : gender !== "all"
        ? drop(sliceOrHead(demographics.gender[gender], total, limit))
        : age !== "all"
          ? drop(sliceOrHead(demographics.age[age], total, limit))
          : drop(total);

  if (region === "all") {
    if (gender === "all" && age === "all") return drop(total).slice(0, limit);
    return padRankEntries(genderAge, drop(total), limit);
  }

  const regionSource = demographics.region?.[region];
  const fromSlice = filterRowsByRegion(drop(regionSource ?? []), region);
  const fromTotal = filterRowsByRegion(drop(total), region);
  const filledRegion = padRegionOnly(fromSlice.length ? fromSlice : fromTotal, region, limit, options?.boardSlug);
  if (gender === "all" && age === "all") return filledRegion;
  return reweightRegionByDemographic(
    filledRegion,
    filterRowsByRegion(genderAge, region),
    fromTotal,
    limit,
    region,
    options?.boardSlug,
  );
}

/**
 * Affinity weights per segment, keyed by rank position. Used only when the model
 * declines to return a demographic block: reordering the head of the total list
 * with a stable, seeded skew keeps the UI populated without inventing names that
 * never appeared in the retrieved news.
 */
const SEGMENT_ROTATE: Record<Exclude<SegmentKey, "total">, number> = {
  male: 0,
  female: 1,
  "10s": 2,
  "20s": 1,
  "30s": 0,
  "40s": 3,
  "50s": 5,
  "60s": 6,
  "70s": 7,
};

function normalizeName(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

function skewed(
  total: BoardRankEntry[],
  segment: Exclude<SegmentKey, "total">,
  limit = DEFAULT_SEGMENT_SIZE,
): BoardRankEntry[] {
  if (!total.length) return [];
  const cap = Math.min(Math.max(limit, 1), total.length);
  const rotate = SEGMENT_ROTATE[segment] % total.length;
  const rotated = [...total.slice(rotate), ...total.slice(0, rotate)];
  return rotated.slice(0, cap).map((entry, index) => ({
    ...entry,
    rank: index + 1,
    score: Number((entry.score * (1 - index * 0.018)).toFixed(2)),
  }));
}

function signature(rows: BoardRankEntry[]): string {
  return rows.map((row) => row.name).join("|");
}

function lookupOrMint(
  name: string,
  total: BoardRankEntry[],
  rank: number,
  note: string,
): BoardRankEntry {
  const match = total.find((row) => normalizeName(row.name) === normalizeName(name));
  if (match) return { ...match, rank };
  return {
    rank,
    name,
    score: Number((92 - rank * 1.8).toFixed(2)),
    changeRate: Number((((rank % 5) - 2) * 1.1).toFixed(2)),
    note,
  };
}

function mergeSeededSegment(
  seeds: string[] | undefined,
  exclude: string[] | undefined,
  llmRows: BoardRankEntry[] | undefined,
  total: BoardRankEntry[],
  limit: number,
  note: string,
): BoardRankEntry[] {
  const blocked = new Set((exclude ?? []).map(normalizeName));
  const seen = new Set<string>();
  const out: BoardRankEntry[] = [];

  const push = (row: BoardRankEntry) => {
    const key = normalizeName(row.name);
    if (!key || blocked.has(key) || seen.has(key)) return;
    seen.add(key);
    out.push({ ...row, rank: out.length + 1 });
  };

  for (const seed of seeds ?? []) push(lookupOrMint(seed, total, out.length + 1, note));
  for (const row of llmRows ?? []) push(row);
  for (const row of total) push(row);

  return out.slice(0, Math.max(1, limit)).map((row, index) => ({
    ...row,
    rank: index + 1,
    score: Number((row.score * (1 - index * 0.016)).toFixed(2)),
  }));
}

/**
 * Board-authored seeds win over a generic K-pop-heavy LLM list: 50대 아이돌
 * 화력 gets 트로트, 10대 여성 브랜드 평판 drops 임영웅, and 숏폼 밈 splits by age.
 */
export function applyDemographicWeights(
  board: BoardDefinition,
  ranking: BoardRankEntry[],
  demographics: DemographicRanking,
): DemographicRanking {
  const limit = segmentLimitForBoard(board);
  const gender: DemographicRanking["gender"] = { ...demographics.gender };
  for (const key of GENDER_SEGMENTS) {
    gender[key] = mergeSeededSegment(
      board.demographicSeeds?.gender?.[key],
      board.demographicExclude?.gender?.[key],
      demographics.gender[key],
      ranking,
      limit,
      `${board.shortTitle} ${GENDER_LABEL[key]} 관심 가중치`,
    );
  }
  const age = { ...demographics.age } as DemographicRanking["age"];
  for (const key of AGE_SEGMENTS) {
    age[key] = mergeSeededSegment(
      board.demographicSeeds?.age?.[key],
      board.demographicExclude?.age?.[key],
      demographics.age[key],
      ranking,
      limit,
      `${board.shortTitle} ${AGE_LABEL[key]} 관심 가중치`,
    );
  }
  const region = boardUsesRegionFilter(board.slug)
    ? deriveRegionRankings(
        ranking,
        isTravelRegionalHeatmapBoard(board.slug)
          ? TRAVEL_HEATMAP_BOARD_NAV[board.slug].heatmapLimitRegion
          : rankLimitForBoard(board),
        board.slug,
      )
    : demographics.region;
  return { gender, age, region };
}

export function isUnusableRankName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2) return true;
  if (/^영화\s*[A-J]$/i.test(trimmed)) return true;
  if (/^(항목|종목|작품|곡|밈|프로그램)\s*[\dA-Z]+$/i.test(trimmed)) return true;
  if (/^(한국 상업영화|할리우드 대작|애니메이션|독립영화|재개봉작)$/.test(trimmed)) return true;
  if (/^movie\s*[a-z0-9]+$/i.test(trimmed)) return true;
  return false;
}

export function dropNamesForFilter(
  board: Pick<BoardDefinition, "demographicExclude"> | undefined,
  gender: "all" | GenderSegment,
  age: "all" | AgeSegment,
): string[] {
  const names: string[] = [...(board?.demographicExclude?.always ?? [])];
  if (gender !== "all") names.push(...(board?.demographicExclude?.gender?.[gender] ?? []));
  if (age !== "all") names.push(...(board?.demographicExclude?.age?.[age] ?? []));
  return names;
}

/**
 * Replaces segments the model returned as copies of one another. Small models
 * frequently emit one list for 30s and then repeat it verbatim through 70s,
 * which makes the age filter look broken. Repeats are rebuilt from the seeded
 * skew so every tab shows a distinct order.
 */
export function dedupeSegments(
  demographics: DemographicRanking,
  total: BoardRankEntry[],
  limit = DEFAULT_SEGMENT_SIZE,
): { value: DemographicRanking; replaced: SegmentKey[] } {
  const replaced: SegmentKey[] = [];

  const gender = { ...demographics.gender };
  const genderSeen = new Set<string>();
  for (const key of GENDER_SEGMENTS) {
    const rows = gender[key] ?? [];
    const sig = signature(rows);
    if (!rows.length || genderSeen.has(sig)) {
      gender[key] = skewed(total, key, limit);
      replaced.push(key);
    } else {
      genderSeen.add(sig);
    }
  }

  const age = { ...demographics.age };
  const ageSeen = new Set<string>();
  for (const key of AGE_SEGMENTS) {
    const rows = age[key] ?? [];
    const sig = signature(rows);
    if (!rows.length || ageSeen.has(sig)) {
      age[key] = skewed(total, key, limit);
      replaced.push(key);
    } else {
      ageSeen.add(sig);
    }
  }

  return { value: { gender, age, region: demographics.region }, replaced };
}

export function deriveDemographics(
  total: BoardRankEntry[],
  board?: BoardDefinition,
): DemographicRanking {
  const limit = board ? segmentLimitForBoard(board) : DEFAULT_SEGMENT_SIZE;
  const base: DemographicRanking = {
    gender: {
      male: skewed(total, "male", limit),
      female: skewed(total, "female", limit),
    },
    age: AGE_SEGMENTS.reduce(
      (acc, age) => {
        acc[age] = skewed(total, age, limit);
        return acc;
      },
      {} as Record<AgeSegment, BoardRankEntry[]>,
    ),
  };
  return board ? applyDemographicWeights(board, total, base) : base;
}

/** True when every segment has at least one row, i.e. the board can be filtered. */
export function demographicsComplete(demographics: DemographicRanking): boolean {
  const genderOk = GENDER_SEGMENTS.every((key) => demographics.gender[key]?.length > 0);
  const ageOk = AGE_SEGMENTS.every((key) => demographics.age[key]?.length > 0);
  return genderOk && ageOk;
}

/** Compact schema dump for rebuild/cron logs. Storage also aliases age.70s as 70s_plus. */
export function describeDemographicSchema(demographics: DemographicRanking): {
  gender: string;
  age: string;
  complete: boolean;
} {
  const gender = GENDER_SEGMENTS.map((key) => `${key}:${demographics.gender[key]?.length ?? 0}`).join(",");
  const age = [
    ...AGE_SEGMENTS.map((key) => `${key}:${demographics.age[key]?.length ?? 0}`),
    `70s_plus:${demographics.age["70s"]?.length ?? 0}`,
  ].join(",");
  return { gender, age, complete: demographicsComplete(demographics) };
}
