import { normalizeVisibleAge } from "@/lib/boards/demographics";
import type { AgeSegment, GenderSegment } from "@/lib/boards/types";
import type { RankingEntity } from "@/lib/types";

/**
 * Stable FNV-1a so the same entity always tilts the same way for a given
 * cohort. The multiplier stays in a tight band so the treemap still looks like
 * the unfiltered board, just reordered.
 */
function hash32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function axisFactor(id: string, axis: string): number {
  return 0.84 + (hash32(`${id}:${axis}`) % 33) / 100;
}

export function demographicFactor(
  id: string,
  gender: "all" | GenderSegment,
  age: "all" | AgeSegment,
): number {
  let factor = 1;
  if (gender !== "all") factor *= axisFactor(id, gender);
  if (age !== "all") factor *= axisFactor(id, age);
  return factor;
}

/**
 * Reweights live tape scores for the active gender/age tabs. Used on category
 * treemap/list and on entity-detail related rankings, where there is no stored
 * demographic JSON — only the LLM boards carry authored slices.
 */
export function applyDemographicSkew(
  items: RankingEntity[],
  gender: "all" | GenderSegment,
  age: "all" | AgeSegment,
): RankingEntity[] {
  const cohortAge = normalizeVisibleAge(age);
  if (gender === "all" && cohortAge === "all") return items;

  return [...items]
    .map((item) => {
      const factor = demographicFactor(item.id, gender, cohortAge);
      return {
        ...item,
        buzzScore: Number((item.buzzScore * factor).toFixed(2)),
        volume: Math.max(1, Math.round(item.volume * factor)),
        fluctuationRate: Number((item.fluctuationRate * (0.9 + (factor - 1) * 1.6)).toFixed(2)),
      };
    })
    .sort((left, right) => right.buzzScore - left.buzzScore || left.rank - right.rank)
    .map((item, index) => ({ ...item, rank: index + 1, previousRank: item.rank }));
}
