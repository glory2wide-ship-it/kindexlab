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
  maxLines?: number; // capped at 2
}> = [
  { name: "부모급여", width: 210, height: 260, minSize: 14, maxSize: 30, minLines: 1 },
  { name: "쇼펜하우어", width: 280, height: 200, minSize: 14, maxSize: 30, minLines: 1 },
  { name: "세이노의 가르침", width: 240, height: 160, minSize: 12, maxSize: 30, minLines: 1 },
  { name: "문화누리카드", width: 150, height: 110, minSize: 11, maxSize: 30, minLines: 1 },
  { name: "김치찌개", width: 140, height: 90, minSize: 12, maxSize: 30, minLines: 1 },
  { name: "웰니스관광", width: 340, height: 280, minSize: 14, maxSize: 30, minLines: 1 },
  { name: "마약김밥", width: 220, height: 150, minSize: 13, maxSize: 30, minLines: 1 },
  // Area budget (not shorter-side %) is the binding 25% rule — short names may exceed
  // 0.25 * min(w,h) while still painting ≤ 25% of tile area.
  { name: "혈압", width: 80, height: 56, minSize: 10, maxSize: 22, minLines: 1 },
  // Small tile: must still paint the FULL name (shrink/wrap — never ellipsize).
  {
    name: "소상공인 전기요금 지원사업",
    width: 96,
    height: 72,
    minSize: 8,
    maxSize: 22,
    minLines: 1,
    maxLines: 2,
  },
  // 5+ chars (spaces included) → multi-line when needed
  { name: "소상공인 전기요금 지원", width: 200, height: 140, minSize: 11, maxSize: 30, minLines: 2 },
  { name: "광장시장 마약김밥 맛집", width: 220, height: 150, minSize: 11, maxSize: 30, minLines: 2 },
  { name: "근로자 휴가지원사업", width: 240, height: 160, minSize: 11, maxSize: 30, minLines: 2 },
  { name: "한화에어로스페이스", width: 100, height: 70, minSize: 9, maxSize: 30, minLines: 1, maxLines: 2 },
  { name: "LG에너지솔루션", width: 72, height: 52, minSize: 9, maxSize: 28, minLines: 1, maxLines: 2 },
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
  const overflow = measureTextWidth(longest, size) > innerW + (item.width < 70 ? 28 : 16);
  const inRange = size >= item.minSize && size <= item.maxSize;
  const linesOk = lines >= (item.minLines ?? 1) && lines <= (item.maxLines ?? 2);
  const fullName =
    painted.replace(/\s+/g, "") === item.name.replace(/\s+/g, "") && !/…|\.\.\./.test(painted);
  const longestWidth = Math.max(
    ...painted.split("\n").map((line) => measureTextWidth(line, size)),
    0,
  );
  const blockH = lines <= 1 ? size : size * (1 + (lines - 1) * 1.28);
  const areaRatio = (longestWidth * blockH) / (item.width * item.height);
  const areaOk = areaRatio <= 0.2501;
  const ok = inRange && !overflow && linesOk && fullName && areaOk;
  if (!ok) failed = true;
  console.log(
    `${ok ? "ok" : "BAD"} ${size.toFixed(1).padStart(5)}px  L${label?.nameLines}  area=${(areaRatio * 100).toFixed(1)}%  len=${item.name.length}  full=${fullName}  ${item.name}`,
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
  {
    name: "진중권 (시사평론가)",
    type: "political_pundit" as const,
    heatmapGroup: "정치평론가",
    expect: "진중권",
  },
  {
    name: "박성민 (정치컨설턴트)",
    type: "political_pundit" as const,
    heatmapGroup: "정치평론가",
    expect: "박성민",
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


const wrapCases: Array<[string, string]> = [
  // ≤7 compact chars → one line (unless strong brand / episode tail)
  ["SK하이닉스", "SK하이닉스"],
  ["소비자물가지수", "소비자물가지수"],
  ["기후동행카드", "기후동행카드"],
  ["문화누리카드", "문화누리카드"],
  ["든든전세주택", "든든전세주택"],
  ["상인푸르지오", "상인\n푸르지오"],
  ["라이브투데이1부", "라이브투데이\n1부"],
  ["2026KBO리그", "2026\nKBO리그"],
  // Longer / spaced names may wrap linguistically
  ["연극〈더 헬멧〉", "연극〈더 헬멧〉"],
  ["스포츠강좌이용권", "스포츠강좌\n이용권"],
  ["소상공인 전기요금 지원", "소상공인\n전기요금 지원"],
  ["근로자 휴가지원사업", "근로자\n휴가지원사업"],
  ["청년도약계좌", "청년도약계좌"],
];
for (const [input, expect] of wrapCases) {
  const got = softWrapHeatmapName(input, 2);
  const ok = got === expect;
  if (!ok) failed = true;
  console.log(`${ok ? "ok" : "BAD"} semantic wrap ${JSON.stringify(input)} → ${JSON.stringify(got)}`);
}

// 공연·도서: long titles may use 3 lines + higher area budget for larger type.
{
  const book = layoutTreemapLabel({
    width: 120,
    height: 100,
    y: 0,
    name: "세이노의 가르침 특별판 한정본",
    rate: "+1.2%",
    typeLabel: "",
    omitRate: true,
    entityType: "book",
  });
  const perf = layoutTreemapLabel({
    width: 110,
    height: 96,
    y: 0,
    name: "뮤지컬 〈레미제라블〉 10주년",
    rate: "+2.0%",
    typeLabel: "",
    omitRate: true,
    entityType: "performance",
  });
  const bookLines = book?.nameLines ?? 0;
  const perfLines = perf?.nameLines ?? 0;
  const bookOk = Boolean(book) && bookLines >= 1 && bookLines <= 3 && (book?.nameSize ?? 0) >= 9;
  const perfOk = Boolean(perf) && perfLines >= 1 && perfLines <= 3 && (perf?.nameSize ?? 0) >= 9;
  if (!bookOk || !perfOk) failed = true;
  console.log(
    `${bookOk ? "ok" : "BAD"} book long-title L${bookLines} ${book?.nameSize?.toFixed(1)}px ${JSON.stringify(book?.name)}`,
  );
  console.log(
    `${perfOk ? "ok" : "BAD"} performance long-title L${perfLines} ${perf?.nameSize?.toFixed(1)}px ${JSON.stringify(perf?.name)}`,
  );
}

const wrapped = softWrapHeatmapName(long, 2);
if (!wrapped.includes("\n")) {
  console.error("expected soft wrap for long spaced name", wrapped);
  failed = true;
}
console.log(`wrap "${long}" → ${JSON.stringify(wrapped)}`);

if (failed) process.exit(1);
console.log("label OK: full names only (wrap/shrink, never abbreviate)");
