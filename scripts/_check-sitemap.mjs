import { existsSync, readFileSync } from "node:fs";

const cacheFile = "src/data/analysis/cache.json";
if (existsSync(cacheFile)) {
  const entries = JSON.parse(readFileSync(cacheFile, "utf8")).entries ?? [];
  const chain = entries.filter((e) => e.provenance?.kind === "chain").length;
  console.log(`로컬 분석 캐시: 전체 ${entries.length}건 · chain ${chain}건 · template ${entries.length - chain}건`);
} else {
  console.log(`로컬 분석 캐시: 파일 없음 (${cacheFile})`);
}

const base = process.argv[2] || "http://localhost:3000";
const xml = await (await fetch(`${base}/sitemap.xml`)).text();
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const ranking = locs.filter((u) => u.includes("/ranking/"));
console.log(`사이트맵: 전체 ${locs.length} URL · /ranking/ ${ranking.length}건`);
