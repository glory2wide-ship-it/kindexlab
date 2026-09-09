import { layoutTreemapLabel, measureTextWidth } from "../src/lib/treemapLabel";
import { heatmapTileLabel, shortenHeatmapLabel } from "../src/lib/heatmap-display-name";

const cases: Array<{
  name: string;
  width: number;
  height: number;
  minSize: number;
  maxSize: number;
}> = [
  { name: "부모급여", width: 210, height: 260, minSize: 14, maxSize: 26 },
  { name: "쇼펜하우어", width: 280, height: 200, minSize: 14, maxSize: 26 },
  { name: "세이노의 가르침", width: 240, height: 160, minSize: 13, maxSize: 26 },
  { name: "문화누리카드", width: 150, height: 110, minSize: 12, maxSize: 24 },
  { name: "김치찌개", width: 140, height: 90, minSize: 12, maxSize: 24 },
  { name: "웰니스관광", width: 340, height: 280, minSize: 14, maxSize: 26 },
  { name: "마약김밥", width: 220, height: 150, minSize: 13, maxSize: 26 },
  { name: "혈압", width: 80, height: 56, minSize: 11, maxSize: 20 },
];

let failed = false;
for (const item of cases) {
  const label = layoutTreemapLabel({
    width: item.width,
    height: item.height,
    y: 0,
    name: item.name,
    rate: "-3.28%",
    typeLabel: "",
  });
  const size = label?.nameSize ?? 0;
  const innerW = item.width - (item.width >= 100 ? 20 : 12);
  const lines = Math.max(1, label?.nameLines ?? 1);
  const overflow = measureTextWidth(item.name, size) / lines > innerW + 12;
  const inRange = size >= item.minSize && size <= item.maxSize;
  const ok = inRange && !overflow && (label?.nameLines ?? 1) <= 2;
  if (!ok) failed = true;
  console.log(
    `${ok ? "ok" : "BAD"} ${size.toFixed(1).padStart(5)}px  L${label?.nameLines}  ${item.name}`,
  );
}

// Same char count → similar sizes across different box shapes (stable density).
const a = layoutTreemapLabel({
  width: 200,
  height: 160,
  y: 0,
  name: "부모급여",
  rate: "+1%",
  typeLabel: "",
})?.nameSize ?? 0;
const b = layoutTreemapLabel({
  width: 180,
  height: 170,
  y: 0,
  name: "부모급여",
  rate: "+1%",
  typeLabel: "",
})?.nameSize ?? 0;
const drift = Math.abs(a - b) / Math.max(a, 1);
console.log(`density drift ${drift.toFixed(3)} (${a.toFixed(1)}/${b.toFixed(1)})`);
if (drift > 0.22) {
  console.error("similar tiles with same Hangul length should keep similar type size");
  failed = true;
}

const shortSamples = [
  {
    name: "뮤지컬 〈엘리자벳〉",
    type: "performance" as const,
    expect: "엘리자벳",
  },
  {
    name: "[보건복지부] 부모급여",
    type: "subsidy" as const,
    heatmapGroup: "경제 정부지원금",
    expectIncludes: "부모급여",
  },
  {
    name: "2026 HIGHLIGHT FAN CON [18년차 아이돌인 내가 이세계에선 데뷔조 연습생?!]",
    type: "performance" as const,
    maxLen: 14,
    expect: "HIGHLIGHT FAN",
  },
];

for (const sample of shortSamples) {
  const tile = heatmapTileLabel({
    name: sample.name,
    nameEn: "",
    type: sample.type,
    heatmapGroup: sample.heatmapGroup,
  });
  const okLen = tile.title.length <= (sample.maxLen ?? 12);
  const okExpect =
    ("expect" in sample && sample.expect ? tile.title === sample.expect : true) &&
    ("expectIncludes" in sample && sample.expectIncludes
      ? tile.title.includes(sample.expectIncludes)
      : true);
  if (!okLen || !okExpect) failed = true;
  console.log(
    `${okLen && okExpect ? "ok" : "BAD"} short "${sample.name}" → "${tile.title}" (full kept: ${tile.fullName === sample.name})`,
  );
}

const long = "아주 긴 공연 타이틀이 여기에 들어와도";
const shortened = shortenHeatmapLabel(long, 10);
console.log(`shorten "${long}" → "${shortened}"`);
if (shortened.length > 10) failed = true;

if (failed) process.exit(1);
console.log("label OK: Hangul density + UI-only short names");
