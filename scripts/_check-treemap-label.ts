import { layoutTreemapLabel, measureTextWidth, softWrapHeatmapName } from "../src/lib/treemapLabel";
import {
  heatmapTileLabel,
  heatmapLabelDisplayLength,
  HEATMAP_WRAP_MIN_CHARS,
} from "../src/lib/heatmap-display-name";

const cases: Array<{
  name: string;
  width: number;
  height: number;
  minSize: number;
  maxSize: number;
  minLines?: number;
}> = [
  { name: "부모급여", width: 210, height: 260, minSize: 14, maxSize: 28, minLines: 1 },
  { name: "쇼펜하우어", width: 280, height: 200, minSize: 14, maxSize: 28, minLines: 1 },
  { name: "세이노의 가르침", width: 240, height: 160, minSize: 13, maxSize: 28, minLines: 1 },
  { name: "문화누리카드", width: 150, height: 110, minSize: 12, maxSize: 28, minLines: 1 },
  { name: "김치찌개", width: 140, height: 90, minSize: 12, maxSize: 28, minLines: 1 },
  { name: "웰니스관광", width: 340, height: 280, minSize: 14, maxSize: 28, minLines: 1 },
  { name: "마약김밥", width: 220, height: 150, minSize: 13, maxSize: 28, minLines: 1 },
  { name: "혈압", width: 80, height: 56, minSize: 11, maxSize: 22, minLines: 1 },
  // 10+ chars (spaces included) → 2 lines
  { name: "소상공인 전기요금 지원", width: 200, height: 140, minSize: 12, maxSize: 28, minLines: 2 },
  { name: "광장시장 마약김밥 맛집", width: 220, height: 150, minSize: 12, maxSize: 28, minLines: 2 },
  { name: "근로자 휴가지원사업", width: 240, height: 160, minSize: 12, maxSize: 28, minLines: 2 },
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
  const painted = label?.name ?? item.name;
  const longest = painted.split("\n").reduce((best, line) => (line.length > best.length ? line : best), "");
  const overflow = measureTextWidth(longest, size) > innerW + 16;
  const inRange = size >= item.minSize && size <= item.maxSize;
  const linesOk = lines >= (item.minLines ?? 1) && lines <= 3;
  const ok = inRange && !overflow && linesOk;
  if (!ok) failed = true;
  console.log(
    `${ok ? "ok" : "BAD"} ${size.toFixed(1).padStart(5)}px  L${label?.nameLines}  len=${item.name.length}  ${item.name}`,
  );
}

const paintSamples = [
  {
    name: "뮤지컬 〈엘리자벳〉",
    type: "performance" as const,
    expect: "뮤지컬 〈엘리자벳〉",
  },
  {
    name: "[보건복지부] 부모급여",
    type: "subsidy" as const,
    heatmapGroup: "경제 정부지원금",
    expect: "부모급여",
  },
  {
    name: "[서울] 광장시장 마약김밥",
    type: "restaurant" as const,
    heatmapGroup: "음식/맛집 랭킹",
    expect: "광장시장 마약김밥",
  },
];

for (const sample of paintSamples) {
  const tile = heatmapTileLabel({
    name: sample.name,
    nameEn: "",
    type: sample.type,
    heatmapGroup: sample.heatmapGroup,
  });
  const ok = tile.title === sample.expect && tile.fullName === sample.name;
  if (!ok) failed = true;
  console.log(`${ok ? "ok" : "BAD"} paint "${sample.name}" → "${tile.title}"`);
}

const long = "소상공인 전기요금 지원";
console.log(
  `displayLen "${long}" = ${heatmapLabelDisplayLength(long)} (wrap ≥${HEATMAP_WRAP_MIN_CHARS})`,
);
if (heatmapLabelDisplayLength(long) < HEATMAP_WRAP_MIN_CHARS) failed = true;

const wrapped = softWrapHeatmapName(long, 2);
if (!wrapped.includes("\n")) {
  console.error("expected soft wrap for 10+ char spaced name", wrapped);
  failed = true;
}
console.log(`wrap "${long}" → ${JSON.stringify(wrapped)}`);

if (failed) process.exit(1);
console.log("label OK: strip brackets + 10+ char multi-line density");
