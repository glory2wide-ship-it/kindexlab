"use client";

import { MobileDialPicker } from "@/components/dashboard/MobileDialPicker";
import { visibleAgeSegments } from "@/lib/boards/age-tabs";
import { AGE_LABEL, GENDER_LABEL } from "@/lib/boards/demographics";
import type { AgeSegment, GenderSegment } from "@/lib/boards/types";
import { TIMEFRAMES } from "@/lib/categories";
import type { Timeframe } from "@/lib/types";

/**
 * Three horizontal dials for mobile heatmap filters.
 * Desktop DemographicTabs / timeframe chips stay unchanged.
 */
export function MobileHeatmapDials({
  timeframe,
  onTimeframe,
  gender,
  onGender,
  age,
  onAge,
  boardSlug,
  hideTimeframes = false,
}: {
  timeframe: Timeframe;
  onTimeframe: (value: Timeframe) => void;
  gender: "all" | GenderSegment;
  onGender: (value: "all" | GenderSegment) => void;
  age: "all" | AgeSegment;
  onAge: (value: "all" | AgeSegment) => void;
  boardSlug?: string;
  hideTimeframes?: boolean;
}) {
  const ages = visibleAgeSegments(boardSlug);
  const beforeAll = ages.filter((key) => ["kids", "10s", "20s", "30s"].includes(key));
  const afterAll = ages.filter((key) => !["kids", "10s", "20s", "30s"].includes(key));

  const timeOptions = TIMEFRAMES.map((item) => ({ id: item.id, label: item.label }));
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

  return (
    <div className="flex gap-1.5 md:hidden">
      {hideTimeframes ? null : (
        <MobileDialPicker
          ariaLabel="기간"
          options={timeOptions}
          value={timeframe}
          onChange={onTimeframe}
        />
      )}
      <MobileDialPicker
        ariaLabel="성별"
        options={genderOptions}
        value={gender}
        onChange={onGender}
      />
      <MobileDialPicker ariaLabel="연령" options={ageOptions} value={age} onChange={onAge} />
    </div>
  );
}
