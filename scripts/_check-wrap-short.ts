import { softWrapHeatmapName } from "../src/lib/treemapLabel";

const cases: Array<[string, string]> = [
  ["상인푸르지오", "상인\n푸르지오"],
  ["SK하이닉스", "SK하이닉스"],
  ["소비자물가지수", "소비자물가지수"],
  ["기후동행카드", "기후동행카드"],
  ["문화누리카드", "문화누리카드"],
  ["든든전세주택", "든든전세주택"],
  ["스포츠강좌이용권", "스포츠강좌\n이용권"],
  ["소상공인 전기요금 지원", "소상공인\n전기요금 지원"],
  ["연극〈더 헬멧〉", "연극〈더 헬멧〉"],
];

let failed = false;
for (const [input, expect] of cases) {
  const got = softWrapHeatmapName(input, 2);
  const ok = got === expect;
  if (!ok) failed = true;
  console.log(`${ok ? "ok" : "BAD"} ${JSON.stringify(input)} → ${JSON.stringify(got)}`);
}
if (failed) process.exit(1);
console.log("wrap short-name rules OK");
