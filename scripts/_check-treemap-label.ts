import { layoutTreemapLabel } from "../src/lib/treemapLabel";

const cases: Array<{
  name: string;
  artist?: string;
  width: number;
  height: number;
  minSize: number;
}> = [
  { name: "김어준의 겸손은 힘들다 뉴스공장", width: 210, height: 260, minSize: 26 },
  { name: "웰니스관광 클러스터", artist: "한국관광공사", width: 340, height: 280, minSize: 30 },
  { name: "근로자 휴가지원사업", artist: "한국관광공사", width: 280, height: 220, minSize: 26 },
  { name: "광장시장 마약김밥", width: 220, height: 150, minSize: 24 },
  { name: "가평 남이섬", width: 200, height: 140, minSize: 24 },
  { name: "데이비드 호크니 특별전 서울", width: 200, height: 120, minSize: 20 },
  { name: "청년도약계좌", width: 170, height: 100, minSize: 20 },
  { name: "세이노의 가르침", width: 240, height: 160, minSize: 26 },
  { name: "베트남 다낭", width: 210, height: 150, minSize: 26 },
];

let failed = false;
for (const item of cases) {
  const label = layoutTreemapLabel({
    width: item.width,
    height: item.height,
    y: 0,
    name: item.name,
    artist: item.artist,
    rate: "-3.28%",
    typeLabel: "85.5",
  });
  const size = label?.nameSize ?? 0;
  const ok = size >= item.minSize;
  if (!ok) failed = true;
  console.log(
    `${ok ? "ok" : "LOW"} ${size.toFixed(1).padStart(5)}px  L${label?.nameLines}  ${item.name}  (${item.width}x${item.height})`,
  );
}
if (failed) process.exit(1);
