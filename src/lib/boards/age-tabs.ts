import { VISIBLE_AGE_SEGMENTS, normalizeVisibleAge } from "@/lib/boards/demographics";
import type { AgeSegment } from "@/lib/boards/types";

const IDOL_AGES: AgeSegment[] = ["10s", "20s", "30s"];
const TROT_AGES: AgeSegment[] = ["40s", "50s", "60s"];

/** Age tabs shown for a ranking board. Undefined means every cohort. */
export function ageTabsForBoard(slug?: string): AgeSegment[] | undefined {
  if (slug === "kpop-fandom-power") return IDOL_AGES;
  if (slug === "trot-kayo-fandom-power") return TROT_AGES;
  return undefined;
}

export function isAgeAllowedForBoard(slug: string | undefined, age: "all" | AgeSegment): boolean {
  if (age === "all") return true;
  const allowed = ageTabsForBoard(slug);
  if (!allowed) return true;
  return allowed.includes(age);
}

/** Drop a hidden cohort onto 전체 when switching boards. */
export function clampAgeForBoard(
  slug: string | undefined,
  age: "all" | AgeSegment,
): "all" | AgeSegment {
  const normalized = normalizeVisibleAge(age);
  return isAgeAllowedForBoard(slug, normalized) ? normalized : "all";
}

export function visibleAgeSegments(slug?: string): AgeSegment[] {
  return ageTabsForBoard(slug) ?? VISIBLE_AGE_SEGMENTS;
}
