import { changeFromScores, pointsFromRate } from "@/lib/ingestion/score";
import {
  previousWeightedApproval,
  weightedApproval,
  type PollBoardSnapshot,
} from "@/lib/politics/polls";
import { changeForEntity, volumeForTimeframe } from "@/lib/timeframes";
import type { MarketIndex, RankingEntity } from "@/lib/types";

export const COMPOSITE_INDEX_ID = "k-buzz";
export const APPROVAL_INDEX_ID = "pol-approval";

const WEIGHTS = {
  culture: 0.4,
  politics: 0.25,
  volume: 0.2,
  approval: 0.15,
} as const;

function mean(values: number[]): number {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return 0;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function avgBuzz(items: RankingEntity[]): number {
  if (!items.length) return 1000;
  return Number((items.reduce((sum, item) => sum + item.buzzScore, 0) / items.length).toFixed(2));
}

function volumeIndex(items: RankingEntity[]): number {
  if (!items.length) return 1000;
  const logs = items.map((item) => Math.log10(Math.max(volumeForTimeframe(item, "1d"), item.volume, 1)));
  const avg = mean(logs);
  return Number((900 + (avg - 4) * 180).toFixed(2));
}

function sectorChange(items: RankingEntity[]): number {
  if (!items.length) return 0;
  const ranked = [...items].sort(
    (a, b) => volumeForTimeframe(b, "1d") - volumeForTimeframe(a, "1d") || a.rank - b.rank,
  );
  const leaders = ranked.slice(0, Math.max(4, Math.ceil(ranked.length * 0.35)));
  return Number(
    mean(
      leaders.map((item) => {
        const live = changeForEntity(item, "1d");
        if (Number.isFinite(live) && live !== 0) return live;
        return item.fluctuationRate;
      }),
    ).toFixed(2),
  );
}

export function approvalIndexValue(polls?: PollBoardSnapshot | null): number {
  const positive = polls?.polls.length ? weightedApproval(polls.polls) : 50;
  return Number((1000 + (positive - 50) * 10).toFixed(2));
}

export function buildApprovalIndex(
  polls?: PollBoardSnapshot | null,
  previous?: MarketIndex[],
): MarketIndex {
  const value = approvalIndexValue(polls);
  const previousPositive = polls?.polls.length ? previousWeightedApproval(polls.polls) : 50;
  const previousValue = Number((1000 + (previousPositive - 50) * 10).toFixed(2));
  const vsPoll = changeFromScores(value, previousValue);
  const vsStored = changeFromScores(value, previous?.find((index) => index.id === APPROVAL_INDEX_ID)?.value);
  const changeRate = vsPoll !== 0 ? vsPoll : vsStored;
  return {
    id: APPROVAL_INDEX_ID,
    label: "대통령지지도",
    value,
    changeRate,
    changePoints: pointsFromRate(value, changeRate),
    previousValue,
    note: polls?.live ? "갤럽·리얼미터 수집" : "갤럽·리얼미터 공표",
  };
}

export function buildKindexComposite(options: {
  cultureItems: RankingEntity[];
  politicsItems: RankingEntity[];
  polls?: PollBoardSnapshot | null;
  previous?: MarketIndex[];
}): MarketIndex {
  const cultureValue = avgBuzz(options.cultureItems);
  const politicsValue = avgBuzz(options.politicsItems);
  const volumeValue = volumeIndex([...options.cultureItems, ...options.politicsItems]);
  const approvalValue = approvalIndexValue(options.polls);
  const value = Number(
    (
      WEIGHTS.culture * cultureValue +
      WEIGHTS.politics * politicsValue +
      WEIGHTS.volume * volumeValue +
      WEIGHTS.approval * approvalValue
    ).toFixed(2),
  );

  const approval = buildApprovalIndex(options.polls, options.previous);
  const changeRate = Number(
    (
      WEIGHTS.culture * sectorChange(options.cultureItems) +
      WEIGHTS.politics * sectorChange(options.politicsItems) +
      WEIGHTS.volume * sectorChange([...options.cultureItems, ...options.politicsItems]) +
      WEIGHTS.approval * approval.changeRate
    ).toFixed(2),
  );

  return {
    id: COMPOSITE_INDEX_ID,
    label: "KindexLab 종합",
    value,
    changeRate,
    changePoints: pointsFromRate(value, changeRate),
    previousValue: Number((value / (1 + changeRate / 100)).toFixed(2)),
    note: "정치 지지도·검색량·이슈 합산",
  };
}

export function withIndexPoints(index: MarketIndex): MarketIndex {
  const stored = index.changePoints;
  const changePoints =
    Number.isFinite(stored) && !(stored === 0 && index.changeRate !== 0)
      ? Number(stored)
      : pointsFromRate(index.value, index.changeRate);
  const previousValue =
    Number.isFinite(index.previousValue)
      ? Number(index.previousValue)
      : index.changeRate === 0
        ? index.value
        : Number((index.value / (1 + index.changeRate / 100)).toFixed(2));
  return { ...index, changePoints, previousValue };
}
