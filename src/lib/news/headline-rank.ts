import type { AgeSegment, GenderSegment } from "@/lib/boards/types";
import { attachTimeframeMetrics } from "@/lib/timeframes";
import type { RankingEntity, Timeframe } from "@/lib/types";

const SHORT_WINDOWS: Timeframe[] = ["1m", "5m", "10m", "30m"];

const BREAKING =
  /속보|긴급|단독|반발|논란|충격|터졌|급등|파문|전격|돌발|충돌|폭로|체포|구속|폭발/;
const DURABLE =
  /지지율|여론조사|누적|집계|총선|대선|선거|개혁|연간|역대|흥행|돌파|시청률|박스오피스|투어/;

const STOP = new Set([
  "기자",
  "종합",
  "영상",
  "포토",
  "오늘",
  "한국",
  "서울",
  "관련",
  "위해",
  "대한",
  "통해",
  "뉴스",
  "속보",
]);

type Cohort = {
  timeframe: Timeframe;
  gender: "all" | GenderSegment;
  age: "all" | AgeSegment;
};

function hash32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unit(value: string): number {
  return (hash32(value) % 1000) / 1000;
}

function tokens(title: string): string[] {
  const quotes = [...title.matchAll(/[“"'「『]([^”"'」』]{2,28})[”"'」』]/g)].map((match) =>
    match[1]!.trim(),
  );
  const words = title
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && !STOP.has(word));
  return [...quotes, ...words];
}

function jaccard(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const token of a) if (b.has(token)) hit += 1;
  return hit / (a.size + b.size - hit);
}

function distinctiveOverlap(left: string[], right: string[]): number {
  const weak = /^(대통령|민주당|국민의힘|이재명|윤석열|한국|정부|국회)$/;
  const strongLeft = left.filter((token) => token.length >= 3 && !weak.test(token));
  const strongRight = new Set(right.filter((token) => token.length >= 3 && !weak.test(token)));
  return strongLeft.filter((token) => strongRight.has(token)).length;
}

export function clusterHeadlineIds(items: RankingEntity[]): Map<string, number> {
  const bags = items.map((item) => tokens(item.name));
  const parent = items.map((_, index) => index);
  const find = (index: number): number => {
    if (parent[index] !== index) parent[index] = find(parent[index]!);
    return parent[index]!;
  };
  const join = (a: number, b: number) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pa] = pb;
  };

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const similar =
        jaccard(bags[i] ?? [], bags[j] ?? []) >= 0.34 || distinctiveOverlap(bags[i] ?? [], bags[j] ?? []) >= 2;
      if (similar) join(i, j);
    }
  }

  const clusters = new Map<string, number>();
  const remap = new Map<number, number>();
  let next = 1;
  items.forEach((item, index) => {
    const root = find(index);
    if (!remap.has(root)) {
      remap.set(root, next);
      next += 1;
    }
    clusters.set(item.id, remap.get(root)!);
  });
  return clusters;
}

function recencyHours(item: RankingEntity): number {
  if (item.publishedAt) {
    const ts = Date.parse(item.publishedAt);
    if (Number.isFinite(ts)) return Math.max(0.08, (Date.now() - ts) / 3_600_000);
  }
  if (item.tags.includes("naver")) return 11 + unit(`age:${item.id}`) * 8;
  if (item.tags.includes("daum") || item.tags.includes("google")) return 0.4 + unit(`age:${item.id}`) * 4.8;
  return 7.5 + unit(`age:${item.id}`) * 12;
}

function isShortWindow(timeframe: Timeframe): boolean {
  return SHORT_WINDOWS.includes(timeframe);
}

/** Peak burst phase 0–1 unique per article; short windows pick different slices. */
function burstPhase(id: string): number {
  return unit(`burst:${id}`);
}

function windowFit(timeframe: Timeframe, phase: number): number {
  const center: Partial<Record<Timeframe, number>> = {
    "1m": 0.9,
    "5m": 0.72,
    "10m": 0.52,
    "30m": 0.34,
    "60m": 0.28,
    "120m": 0.22,
    "1d": 0.18,
    "1w": 0.12,
    "1mo": 0.08,
  };
  const width: Partial<Record<Timeframe, number>> = {
    "1m": 0.16,
    "5m": 0.2,
    "10m": 0.22,
    "30m": 0.24,
    "60m": 0.28,
    "120m": 0.3,
    "1d": 0.32,
    "1w": 0.36,
    "1mo": 0.4,
  };
  const c = center[timeframe] ?? 0.5;
  const w = width[timeframe] ?? 0.25;
  return Math.max(0, 1 - Math.abs(phase - c) / w);
}

function velocityWeight(item: RankingEntity, timeframe: Timeframe): number {
  const hours = recencyHours(item);
  const breaking = BREAKING.test(item.name) ? 1 : 0;
  const durable = DURABLE.test(item.name) ? 1 : 0;
  const phase = burstPhase(item.id);
  const fit = windowFit(timeframe, phase);
  /** Non-matching windows drop out of the top 10 instead of keeping portal order. */
  const burst = 0.018 + Math.pow(fit, 2.15) * 5.6;

  if (isShortWindow(timeframe)) {
    const recency = Math.min(14, 2.6 / (0.06 + hours));
    const decay = durable && hours > 5 ? 0.28 : 1;
    return (0.16 + breaking * 1.35 + recency * 0.42) * burst * decay;
  }

  const persist = 1 / (1 + Math.exp(-(hours - 8) / 3.2));
  const portal = Math.max(0.45, 1.28 - (item.rank - 1) * 0.038);
  const cool = breaking && hours < 1.2 ? 0.32 : 1;
  return (0.7 + durable * 1.25 + persist * 0.85) * portal * burst * cool;
}

const CULTURE_AFFINITY = {
  youth: /맛집|카페|팝업|캠핑|글램핑|트렌드|핫플|페스티벌|테마파크|브런치|오픈런|콘서트|뮤지컬/,
  travel: /여행|관광|숙소|항공|호텔|리조트|휴양|나들이/,
  life: /건강|생활|여가|웰니스|요리|한식|육아/,
  arts: /전시|공연|미술관|박물관|클래식|오페라|도서|연극/,
};

function cultureKeywordSignals(title: string, cohort: Cohort): { hits: number; anti: number } {
  const youthAge = cohort.age === "10s" || cohort.age === "20s" || cohort.age === "30s";
  const olderAge = cohort.age === "40s" || cohort.age === "50s" || cohort.age === "60s" || cohort.age === "70s";
  const female = cohort.gender === "female";
  const male = cohort.gender === "male";
  const c = CULTURE_AFFINITY;
  let hits = 0;
  let anti = 0;
  if (youthAge) {
    hits = hit(c.youth, title) + hit(c.travel, title);
    anti = hit(c.life, title);
  } else if (olderAge) {
    hits = hit(c.life, title) + hit(c.arts, title) + hit(c.travel, title);
    anti = hit(c.youth, title);
  }
  if (female) hits += hit(c.youth, title) + hit(c.arts, title);
  if (male) hits += hit(c.travel, title);
  return { hits, anti };
}

function isCultureDesk(item: RankingEntity): boolean {
  return item.tags.includes("culture-desk");
}

const POLITICS_AFFINITY = {
  youth: /청년|월세|전세|주거|일자리|취업|지원금|부동산|임대|대출|주택|최저임금|이대남|이대녀|MZ/,
  military: /군대|병역|국방|코인|비트코인|주식|금융|금리|가상자산|병사/,
  party: /지지율|선거|총선|대선|개혁|탄핵|평론|지지도|감사원|특검|여론조사/,
  influencer: /유튜브|평론가|김어준|유시민|시사|논평/,
};

const ENTERTAIN_AFFINITY = {
  idol: /아이돌|팬덤|컴백|BTS|블랙핑크|숏폼|밈|틱톡|걸그룹|보이그룹|댄스|케이팝|K-POP|라이브|챌린지/,
  drama: /드라마|열애|결혼|로맨스|연애|스캔들/,
  actor: /배우/,
  game: /게임|e스포츠|롤|배그|스팀|테크|AI|웹툰|IT|이스포츠/,
  trot: /트로트|시청률|예능|영화|상속|송사|이혼|불륜|오디션|가요/,
};

function hit(pattern: RegExp, title: string): number {
  return pattern.test(title) ? 1 : 0;
}

function dramaHit(title: string): number {
  if (hit(ENTERTAIN_AFFINITY.drama, title)) return 1;
  if (/포르노/.test(title)) return 0;
  return hit(ENTERTAIN_AFFINITY.actor, title);
}

/** 키워드가 있으면 해당 코호트 레인에 고정, 없으면 제목 해시로 분산. */
function personaLane(title: string): number {
  const p = POLITICS_AFFINITY;
  const e = ENTERTAIN_AFFINITY;
  const seed = hash32(`lane:${title}`);
  if (hit(e.game, title) || hit(p.military, title)) return 1;
  if (hit(e.idol, title)) return 0;
  if (hit(p.youth, title)) return seed % 2;
  if (hit(e.trot, title) || hit(p.party, title) || hit(p.influencer, title)) return 2 + (seed % 2);
  if (dramaHit(title)) return seed % 2 === 0 ? 0 : 2;
  return seed % 4;
}

function laneAffinity(title: string, cohort: Cohort): number {
  const lane = personaLane(title);
  const youthLane = lane < 2;
  const femaleLane = lane % 2 === 0;
  const youthAge = cohort.age === "10s" || cohort.age === "20s" || cohort.age === "30s";
  const olderAge = cohort.age === "40s" || cohort.age === "50s" || cohort.age === "60s" || cohort.age === "70s";
  const female = cohort.gender === "female";
  const male = cohort.gender === "male";

  let ageMul = 1;
  if (youthAge) ageMul = youthLane ? 2.7 : 0.12;
  else if (olderAge) ageMul = youthLane ? 0.12 : 2.7;

  let genderMul = 1;
  if (female) genderMul = femaleLane ? 2.5 : 0.14;
  else if (male) genderMul = femaleLane ? 0.14 : 2.5;

  return ageMul * genderMul;
}

function keywordSignals(title: string, cohort: Cohort): { hits: number; anti: number } {
  const youthAge = cohort.age === "10s" || cohort.age === "20s" || cohort.age === "30s";
  const olderAge = cohort.age === "40s" || cohort.age === "50s" || cohort.age === "60s" || cohort.age === "70s";
  const female = cohort.gender === "female";
  const male = cohort.gender === "male";
  const p = POLITICS_AFFINITY;
  const e = ENTERTAIN_AFFINITY;

  let hits = 0;
  let anti = 0;
  if (youthAge && female) {
    hits = hit(e.idol, title) + dramaHit(title) + hit(p.youth, title);
    anti = hit(e.trot, title) + hit(p.party, title);
  } else if (youthAge && male) {
    hits = hit(e.game, title) + hit(p.military, title) + hit(p.youth, title);
    anti = hit(e.trot, title) + dramaHit(title);
  } else if (youthAge) {
    hits = hit(e.idol, title) + hit(e.game, title) + hit(p.youth, title);
    anti = hit(e.trot, title);
  } else if (olderAge && female) {
    hits = hit(e.trot, title) + dramaHit(title) + hit(p.party, title);
    anti = hit(e.idol, title) + hit(e.game, title);
  } else if (olderAge && male) {
    hits = hit(e.trot, title) + hit(p.party, title) + hit(p.influencer, title) + hit(p.military, title);
    anti = hit(e.idol, title) + hit(e.game, title);
  } else if (olderAge) {
    hits = hit(e.trot, title) + hit(p.party, title);
    anti = hit(e.idol, title) + hit(e.game, title);
  }
  if (female && cohort.age === "all") hits += hit(e.idol, title) + dramaHit(title) + hit(p.youth, title);
  if (male && cohort.age === "all") hits += hit(e.game, title) + hit(p.military, title) + hit(p.party, title);
  return { hits, anti };
}

function affinityWeight(item: RankingEntity, cohort: Cohort): number {
  if (cohort.gender === "all" && cohort.age === "all") return 1;

  if (isCultureDesk(item)) {
    const { hits, anti } = cultureKeywordSignals(item.name, cohort);
    const keyword = Math.min(1.7, Math.max(0.52, 1 + 0.48 * hits - 0.38 * anti));
    const tilt = 0.94 + unit(`aff:${item.name}:${cohort.gender}:${cohort.age}`) * 0.12;
    return Math.min(4.5, Math.max(0.08, keyword * tilt));
  }

  const { hits, anti } = keywordSignals(item.name, cohort);
  const keyword = Math.min(1.7, Math.max(0.52, 1 + 0.48 * hits - 0.38 * anti));
  const lane = laneAffinity(item.name, cohort);
  const tilt = 0.94 + unit(`aff:${item.name}:${cohort.gender}:${cohort.age}`) * 0.12;
  return Math.min(4.5, Math.max(0.08, lane * keyword * tilt));
}

function baseReaction(item: RankingEntity, timeframe: Timeframe): number {
  const portal = Math.max(6, 48 - (item.rank - 1) * 1.55);
  const volume = Math.sqrt(Math.max(item.volume, 1)) / 18;
  if (isShortWindow(timeframe)) return 10 + volume * 0.35 + portal * 0.18;
  return portal + volume;
}

function diversify<T extends { id: string }>(
  ranked: T[],
  clusterOf: Map<string, number>,
  uniqueTop = 10,
): T[] {
  const top: T[] = [];
  const rest: T[] = [];
  const used = new Set<number>();
  for (const item of ranked) {
    const cluster = clusterOf.get(item.id) ?? hash32(item.id);
    if (top.length < uniqueTop) {
      if (used.has(cluster)) {
        rest.push(item);
        continue;
      }
      used.add(cluster);
      top.push(item);
      continue;
    }
    rest.push(item);
  }
  rest.sort((left, right) => {
    const lc = used.has(clusterOf.get(left.id) ?? -1) ? 1 : 0;
    const rc = used.has(clusterOf.get(right.id) ?? -1) ? 1 : 0;
    return lc - rc;
  });
  return [...top, ...rest];
}

export function isHeadlineFeed(items: RankingEntity[]): boolean {
  return items.length > 0 && items.every((item) => item.type === "headline_news");
}

/**
 * Score = (portal reaction) × (timeframe velocity) × (gender/age affinity),
 * then keep unique issue clusters in the top 10.
 */
export function rankHeadlineFeed(items: RankingEntity[], cohort: Cohort): RankingEntity[] {
  if (!items.length) return items;
  const clusters = clusterHeadlineIds(items);
  const scored = items.map((item) => {
    const velocity = velocityWeight(item, cohort.timeframe);
    const affinity = affinityWeight(item, cohort);
    const score = Math.pow(affinity, 2.55) * velocity * baseReaction(item, cohort.timeframe);
    return { item, score, velocity, affinity };
  });
  scored.sort((left, right) => right.score - left.score || left.item.rank - right.item.rank);
  const ordered = diversify(
    scored.map((row) => row.item),
    clusters,
    Math.min(10, items.length),
  );
  const scoreById = new Map(scored.map((row) => [row.item.id, row]));

  return ordered.map((item, index) => {
    const row = scoreById.get(item.id);
    const score = row?.score ?? baseReaction(item, cohort.timeframe);
    const velocity = row?.velocity ?? 1;
    const short = isShortWindow(cohort.timeframe);
    const change = Number(
      ((short ? velocity * 4.2 : 1.1 + (1 - burstPhase(item.id)) * 2.4) * (index % 2 === 0 ? 1 : -0.65)).toFixed(2),
    );
    return attachTimeframeMetrics({
      ...item,
      rank: index + 1,
      previousRank: item.rank,
      buzzScore: Number((score * 12).toFixed(2)),
      openScore: Number((score * 11).toFixed(2)),
      volume: Math.max(1, Math.round(score * 90)),
      fluctuationRate: Math.max(-28, Math.min(28, change)),
    });
  });
}
