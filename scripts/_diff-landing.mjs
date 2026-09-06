import { readFileSync, statSync } from "node:fs";

/** Entity names as they appear in the streamed RSC payload of a landing page. */
function names(file) {
  const html = readFileSync(file, "utf8");
  const found = [...html.matchAll(/\\"name\\":\\"([^\\"]{2,40})\\"/g)].map((m) => m[1]);
  return found;
}

const [a, b] = [process.argv[2] ?? "page1.html", process.argv[3] ?? "page2.html"];
const one = names(a);
const two = names(b);

console.log(`추출 항목  ${a}: ${one.length}개 · ${b}: ${two.length}개`);
console.log(`바이트     ${statSync(a).size} vs ${statSync(b).size}`);
console.log(`상위 40 동일 여부: ${JSON.stringify(one.slice(0, 40)) === JSON.stringify(two.slice(0, 40)) ? "완전 동일" : "다름"}`);
console.log(`\n${a} 상위 12:\n  ${one.slice(0, 12).join(" | ")}`);
console.log(`\n${b} 상위 12:\n  ${two.slice(0, 12).join(" | ")}`);

const onlyInTwo = two.slice(0, 40).filter((n) => !one.slice(0, 40).includes(n));
console.log(`\n2회차에만 등장한 상위 항목: ${onlyInTwo.length ? onlyInTwo.join(", ") : "없음"}`);
