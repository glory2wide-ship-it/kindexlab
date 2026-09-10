import { layoutTreemapLabel, measureTextWidth } from "../src/lib/treemapLabel";
import { heatmapTileLabel, heatmapLabelDisplayLength } from "../src/lib/heatmap-display-name";

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
  { name: "세이노의 가르침", width: 240, height: 160, minSize: 13, maxSize: 28, minLines: 2 },
  { name: "문화누리카드", width: 150, height: 110, minSize: 12, maxSize: 28, minLines: 2 },
  { name: "김치찌개", width: 140, height: 90, minSize: 12, maxSize: 28, minLines: 1 },
  { name: "웰니스관광", width: 340, height: 280, minSize: 14, maxSize: 28, minLines: 1 },
  { name: "마약김밥", width: 220, height: 150, minSize: 13, maxSize: 28, minLines: 1 },
  { name: "혈압", width: 80, height: 56, minSize: 11, maxSize: 22, minLines: 1 },
  { name: "[보건복지부] 부모급여", width: 200, height: 140, minSize: 12, maxSize: 28, minLines: 2 },
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
    `${ok ? "ok" : "BAD"} ${size.toFixed(1).padStart(5)}px  L${label?.nameLines}  ${item.name}`,
  );
}

const a =
  layoutTreemapLabel({
    width: 200,
    height: 160,
    y: 0,
    name: "부모급여",
    rate: "+1%",
    typeLabel: "",
  })?.nameSize ?? 0;
const b =
  layoutTreemapLabel({
    width: 180,
    height: 170,
    y: 0,
    name: "부모급여",
    rate: "+1%",
    typeLabel: "",
  })?.nameSize ?? 0;
const drift = Math.abs(a - b) / Math.max(a, 1);
console.log(`density drift ${drift.toFixed(3)} (${a.toFixed(1)}/${b.toFixed(1)})`);
if (drift > 0.28) {
  console.error("similar tiles with same Hangul length should keep similar type size");
  failed = true;
}

const fullNameSamples = [
  {
    name: "뮤지컬 〈엘리자벳〉",
    type: "performance" as const,
    expect: "뮤지컬 〈엘리자벳〉",
  },
  {
    name: "[보건복지부] 부모급여",
    type: "subsidy" as const,
    heatmapGroup: "경제 정부지원금",
    expect: "[보건복지부] 부모급여",
  },
  {
    name: "2026 HIGHLIGHT FAN CON [18년차 아이돌인 내가 이세계에선 데뷔조 연습생?!]",
    type: "performance" as const,
    expect: "2026 HIGHLIGHT FAN CON [18년차 아이돌인 내가 이세계에선 데뷔조 연습생?!]",
  },
];

for (const sample of fullNameSamples) {
  const tile = heatmapTileLabel({
    name: sample.name,
    nameEn: "",
    type: sample.type,
    heatmapGroup: sample.heatmapGroup,
  });
  const ok =
    tile.title === sample.expect &&
    tile.fullName === sample.name &&
    tile.title === tile.fullName;
  if (!ok) failed = true;
  console.log(`${ok ? "ok" : "BAD"} full "${sample.name}" → "${tile.title}"`);
}

const long = "세이노의 가르침";
console.log(`displayLen "${long}" = ${heatmapLabelDisplayLength(long)} (expect wrap ≥6)`);
if (heatmapLabelDisplayLength(long) < 6) failed = true;

if (failed) process.exit(1);
console.log("label OK: full names + 6+ char multi-line density");
