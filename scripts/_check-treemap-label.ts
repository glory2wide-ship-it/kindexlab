import { layoutTreemapLabel, measureTextWidth } from "../src/lib/treemapLabel";

const cases: Array<{
  name: string;
  width: number;
  height: number;
  minSize: number;
  maxSize: number;
}> = [
  { name: "김어준의 겸손은 힘들다 뉴스공장", width: 210, height: 260, minSize: 16, maxSize: 34 },
  { name: "마흔에 읽는 쇼펜하우어", width: 280, height: 200, minSize: 16, maxSize: 34 },
  { name: "세이노의 가르침", width: 240, height: 160, minSize: 16, maxSize: 34 },
  { name: "문화누리카드", width: 150, height: 110, minSize: 13, maxSize: 28 },
  { name: "김치찌개", width: 140, height: 90, minSize: 13, maxSize: 28 },
  { name: "웰니스관광 클러스터", width: 340, height: 280, minSize: 18, maxSize: 34 },
  { name: "광장시장 마약김밥", width: 220, height: 150, minSize: 15, maxSize: 34 },
  { name: "혈압", width: 80, height: 56, minSize: 11, maxSize: 22 },
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
  const overflow = measureTextWidth(item.name, size) / lines > innerW + 10;
  const inRange = size >= item.minSize && size <= item.maxSize;
  const ok = inRange && !overflow && (label?.nameLines ?? 1) <= 2;
  if (!ok) failed = true;
  console.log(
    `${ok ? "ok" : "BAD"} ${size.toFixed(1).padStart(5)}px  L${label?.nameLines}  ${item.name}`,
  );
}
if (failed) process.exit(1);

// Larger tiles must render larger type than small tiles (Finviz readability).
const big = layoutTreemapLabel({
  width: 280,
  height: 200,
  y: 0,
  name: "세이노의 가르침",
  rate: "+1.2%",
  typeLabel: "",
})?.nameSize ?? 0;
const small = layoutTreemapLabel({
  width: 90,
  height: 60,
  y: 0,
  name: "세이노의 가르침",
  rate: "+1.2%",
  typeLabel: "",
})?.nameSize ?? 0;
console.log(`big/small ${big.toFixed(1)}/${small.toFixed(1)}`);
if (big <= small) {
  console.error("larger tiles must use larger name sizes");
  process.exit(1);
}
console.log("label OK: Finviz-style size tracks tile area");
