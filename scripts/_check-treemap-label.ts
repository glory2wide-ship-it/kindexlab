import { layoutTreemapLabel } from "../src/lib/treemapLabel";

const names = [
  "광장시장 마약김밥",
  "가평 남이섬",
  "근로자 휴가지원사업",
  "마흔에 읽는 쇼펜하우어",
  "소상공인 전기요금 지원",
  "나혼자만 레벨업",
];

const tiles = [
  { width: 180, height: 140 },
  { width: 140, height: 110 },
  { width: 110, height: 88 },
];

for (const name of names) {
  const rows = tiles.map((tile) => {
    const label = layoutTreemapLabel({
      ...tile,
      y: 0,
      name,
      rate: "+4.2%",
      typeLabel: "882.0",
    });
    return {
      box: `${tile.width}x${tile.height}`,
      size: label?.nameSize,
      lines: label?.nameLines,
    };
  });
  const tooSmall = rows.some((row) => (row.size ?? 0) < 15);
  console.log(name, JSON.stringify(rows), tooSmall ? "SMALL" : "ok");
  if (tooSmall) process.exitCode = 1;
}
