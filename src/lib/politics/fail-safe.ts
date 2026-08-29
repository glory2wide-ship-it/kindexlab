import { namesOverlap } from "@/lib/ingestion/names";
import type { BoardRankEntry } from "@/lib/boards/types";
import { influencerSeedNames, matchPoliticsYoutubeSeed } from "@/lib/politics/youtube-seeds";
import type { RankingEntity } from "@/lib/types";

const TOP_N = 10;

function isDeadScore(value: number | null | undefined): boolean {
  return !Number.isFinite(value) || (value as number) <= 0;
}

function matchByName<T extends { name: string }>(rows: T[], name: string): T | undefined {
  return rows.find((row) => namesOverlap(row.name, name));
}

/**
 * Seed channels stay on the 정치 인기 유튜브 랭킹 board even when the LLM invents
 * placeholders or drops large news/media talk shows.
 */
export function ensureInfluencerBoardRanking(rows: BoardRankEntry[]): BoardRankEntry[] {
  const next = rows.map((row) => {
    const seed = matchPoliticsYoutubeSeed(row.name);
    return seed ? { ...row, name: seed.name } : { ...row };
  });
  const seeds = influencerSeedNames();
  for (const name of seeds) {
    const existing = next.find((row) => namesOverlap(row.name, name));
    if (existing) {
      existing.name = name;
      continue;
    }
    next.push({
      rank: next.length + 1,
      name,
      score: name.includes("뉴스공장") ? 96.5 : Number((91 - next.length * 0.8).toFixed(2)),
      changeRate: 0,
      note: "대형 시사 채널 씨드 · 수집 누락 보완",
    });
  }
  next.sort((left, right) => {
    const leftSeed = seeds.some((name) => namesOverlap(left.name, name)) ? 1 : 0;
    const rightSeed = seeds.some((name) => namesOverlap(right.name, name)) ? 1 : 0;
    if (leftSeed !== rightSeed) return rightSeed - leftSeed;
    const leftLead = /뉴스공장|겸손은/.test(left.name) ? 1 : 0;
    const rightLead = /뉴스공장|겸손은/.test(right.name) ? 1 : 0;
    if (leftLead !== rightLead) return rightLead - leftLead;
    return right.score - left.score || left.rank - right.rank;
  });
  return next.map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * If a previous top-10 channel comes back as missing, 0, or null, keep the last
 * healthy snapshot so a bad crawl cannot wipe leaders off the heatmap.
 */
export function carryForwardBoardLeaders(
  next: BoardRankEntry[],
  previous: BoardRankEntry[] | undefined,
  topN = TOP_N,
): BoardRankEntry[] {
  if (!previous?.length) return next;
  const leaders = [...previous].sort((a, b) => a.rank - b.rank).slice(0, topN);
  const merged = [...next];
  for (const leader of leaders) {
    if (isDeadScore(leader.score)) continue;
    const current = matchByName(merged, leader.name);
    if (!current) {
      if (!matchPoliticsYoutubeSeed(leader.name)) continue;
      merged.push({ ...leader, note: `${leader.note} · 직전 정상치 유지` });
      continue;
    }
    if (isDeadScore(current.score)) {
      current.score = leader.score;
      current.changeRate = leader.changeRate;
      current.note = current.note || leader.note;
    }
  }
  return merged
    .sort((a, b) => b.score - a.score || a.rank - b.rank)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function carryForwardInfluencerEntities(
  next: RankingEntity[],
  previous: RankingEntity[] | undefined,
  type: RankingEntity["type"] = "political_influencer",
  topN = TOP_N,
): RankingEntity[] {
  if (!previous?.length) return next;
  const prevLeaders = previous
    .filter((item) => item.type === type)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, topN);
  const others = next.filter((item) => item.type !== type);
  const current = next.filter((item) => item.type === type);
  for (const leader of prevLeaders) {
    if (isDeadScore(leader.buzzScore)) continue;
    const match = matchByName(current, leader.name);
    if (!match) {
      current.push({
        ...leader,
        summary: `${leader.name}은(는) 직전 정상 수집치를 유지합니다.`,
      });
      continue;
    }
    if (isDeadScore(match.buzzScore) || isDeadScore(match.volume)) {
      match.buzzScore = leader.buzzScore;
      match.openScore = leader.openScore;
      match.volume = leader.volume;
      match.sparkline = leader.sparkline;
      match.history = leader.history;
      match.fluctuationRate = leader.fluctuationRate;
    }
  }
  const ranked = current
    .sort((a, b) => b.buzzScore - a.buzzScore || a.rank - b.rank)
    .map((item, index) => ({ ...item, rank: index + 1 }));
  return [...others, ...ranked];
}
