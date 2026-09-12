"use client";

import { MobileDialPicker } from "@/components/dashboard/MobileDialPicker";
import { visibleAgeSegments } from "@/lib/boards/age-tabs";
import { AGE_LABEL, GENDER_LABEL } from "@/lib/boards/demographics";
import { REGION_LABEL, REGION_SEGMENTS } from "@/lib/boards/regions";
import type { AgeSegment, GenderSegment, RegionSegment } from "@/lib/boards/types";
import { TIMEFRAMES } from "@/lib/categories";
import type { Timeframe } from "@/lib/types";

/**
 * Horizontal dials for mobile heatmap filters.
 * Optional region dial sits on a second row (부동산·여행 등 시/도 보드).
 */
export function MobileHeatmapDials({
  timeframe,
  onTimeframe,
  gender,
  onGender,
  age,
  onAge,
  region = "all",
  onRegion,
  showRegion = false,
  boardSlug,
  hideTimeframes = false,
}: {
  timeframe: Timeframe;
  onTimeframe: (value: Timeframe) => void;
  gender: "all" | GenderSegment;
  onGender: (value: "all" | GenderSegment) => void;
  age: "all" | AgeSegment;
  onAge: (value: "all" | AgeSegment) => void;
  region?: "all" | RegionSegment;
  onRegion?: (value: "all" | RegionSegment) => void;
  showRegion?: boolean;
  boardSlug?: string;
  hideTimeframes?: boolean;
}) {
  const ages = visibleAgeSegments(boardSlug);
  const beforeAll = ages.filter((key) => ["kids", "10s", "20s", "30s"].includes(key));
  const afterAll = ages.filter((key) => !["kids", "10s", "20s", "30s"].includes(key));

  /**
   * Mobile dial shows only 5·10·30 so the default 10분 center reads as
   * 5분 | 10분 | 30분 (MarketWorkspace mobile default).
   */
  const timeOptions = TIMEFRAMES.filter((item) =>
    item.id === "5m" || item.id === "10m" || item.id === "30m",
  ).map((item) => ({ id: item.id, label: item.label }));
  const genderOptions = [
    { id: "male" as const, label: GENDER_LABEL.male },
    { id: "all" as const, label: "전체" },
    { id: "female" as const, label: GENDER_LABEL.female },
  ];
  /** 전체 sits between 30대 and 40대 (mock order). */
  const ageOptions = [
    ...beforeAll.map((key) => ({ id: key, label: AGE_LABEL[key] })),
    { id: "all" as const, label: "전체" },
    ...afterAll.map((key) => ({ id: key, label: AGE_LABEL[key] })),
  ];

  /** 전체 centered among 시/도 so neighbors stay visible like age dials. */
  const mid = Math.ceil(REGION_SEGMENTS.length / 2);
  const regionOptions = [
    ...REGION_SEGMENTS.slice(0, mid).map((key) => ({ id: key, label: REGION_LABEL[key] })),
    { id: "all" as const, label: "전체" },
    ...REGION_SEGMENTS.slice(mid).map((key) => ({ id: key, label: REGION_LABEL[key] })),
  ];

  return (
    <div className="flex flex-col gap-1 md:hidden">
      <div className="flex gap-1">
        {hideTimeframes ? null : (
          <MobileDialPicker
            ariaLabel="기간"
            options={timeOptions}
            value={timeframe}
            onChange={onTimeframe}
            grow={1.22472}
          />
        )}
        <MobileDialPicker
          ariaLabel="성별"
          options={genderOptions}
          value={gender}
          onChange={onGender}
          grow={1.1}
        />
        <MobileDialPicker
          ariaLabel="연령"
          options={ageOptions}
          value={age}
          onChange={onAge}
          grow={1.189728}
        />
      </div>
      {showRegion && onRegion ? (
        <MobileDialPicker
          ariaLabel="지역"
          options={regionOptions}
          value={region}
          onChange={onRegion}
        />
      ) : null}
    </div>
  );
}
