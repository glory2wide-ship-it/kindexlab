"use client";

import {
  AGE_LABEL,
  GENDER_LABEL,
  GENDER_SEGMENTS,
} from "@/lib/boards/demographics";
import { visibleAgeSegments } from "@/lib/boards/age-tabs";
import { REGION_LABEL, REGION_SEGMENTS } from "@/lib/boards/regions";
import type { AgeSegment, GenderSegment, RegionSegment } from "@/lib/boards/types";

const TAB_BASE =
  "rounded-md px-3 py-1.5 text-xs font-medium transition-[color,background-color,transform] duration-200 ease-out";
const GENDER_ON = "bg-accent text-black scale-[1.03]";
const GENDER_OFF = "text-muted hover:text-ink";
const AGE_ON = "bg-ink text-board scale-[1.03]";
const AGE_OFF = "text-muted hover:bg-panel hover:text-ink";

/**
 * Gender and age sit on one row: gender group, then age group to the right.
 * Pass `boardSlug` to hide cohorts that do not apply to that board.
 */
export function DemographicTabs({
  gender,
  age,
  onGender,
  onAge,
  boardSlug,
  ageSegments,
  region = "all",
  onRegion,
  showRegion = false,
}: {
  gender: "all" | GenderSegment;
  age: "all" | AgeSegment;
  onGender: (value: "all" | GenderSegment) => void;
  onAge: (value: "all" | AgeSegment) => void;
  boardSlug?: string;
  ageSegments?: AgeSegment[];
  region?: "all" | RegionSegment;
  onRegion?: (value: "all" | RegionSegment) => void;
  showRegion?: boolean;
}) {
  const ages = ageSegments ?? visibleAgeSegments(boardSlug);

  return (
    <div className="flex flex-col gap-2">
    <div className="flex flex-row flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-board p-1">
          <button
            type="button"
            onClick={() => onGender("all")}
            className={`${TAB_BASE} ${gender === "all" ? GENDER_ON : GENDER_OFF}`}
          >
            전체
          </button>
          {GENDER_SEGMENTS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onGender(key)}
              className={`${TAB_BASE} ${gender === key ? GENDER_ON : GENDER_OFF}`}
            >
              {GENDER_LABEL[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-board p-1">
          <button
            type="button"
            onClick={() => onAge("all")}
            className={`${TAB_BASE} ${age === "all" ? AGE_ON : AGE_OFF}`}
          >
            전체
          </button>
          {ages.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onAge(key)}
              className={`${TAB_BASE} ${age === key ? AGE_ON : AGE_OFF}`}
            >
              {AGE_LABEL[key]}
            </button>
          ))}
        </div>
      </div>
    </div>

      {showRegion && onRegion ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg bg-board p-1">
            <button
              type="button"
              onClick={() => onRegion("all")}
              className={`${TAB_BASE} ${region === "all" ? AGE_ON : AGE_OFF}`}
            >
              전체
            </button>
            {REGION_SEGMENTS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onRegion(key)}
                className={`${TAB_BASE} ${region === key ? AGE_ON : AGE_OFF}`}
              >
                {REGION_LABEL[key]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
