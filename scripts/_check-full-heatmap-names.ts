import { layoutTreemapLabel } from "../src/lib/treemapLabel";

const stocks = [
  "삼성전자",
  "SK하이닉스",
  "LG에너지솔루션",
  "한화에어로스페이스",
  "삼성바이오로직스",
  "POSCO홀딩스",
  "KB금융",
  "현대차",
  "엔비디아",
  "마이크로소프트",
  "TSMC",
];
const sizes: Array<[number, number]> = [
  [220, 160],
  [140, 100],
  [100, 70],
  [72, 52],
  [56, 40],
  [48, 32],
];

let failed = false;
for (const name of stocks) {
  for (const [w, h] of sizes) {
    const label = layoutTreemapLabel({
      width: w,
      height: h,
      y: 0,
      name,
      rate: "+1.2%",
      typeLabel: "",
      omitRate: false,
    });
    const painted = (label?.name ?? "").replace(/\n/g, "");
    const ok =
      painted.replace(/\s+/g, "") === name.replace(/\s+/g, "") &&
      !/…|\.\.\./.test(label?.name ?? "");
    if (!ok) {
      failed = true;
      console.log(
        `FAIL ${w}x${h} in=${name} paint=${JSON.stringify(label?.name)} size=${label?.nameSize}`,
      );
    }
  }
}
console.log(failed ? "STOCK FULL-NAME CHECK FAILED" : "STOCK FULL-NAME CHECK OK");
process.exit(failed ? 1 : 0);
