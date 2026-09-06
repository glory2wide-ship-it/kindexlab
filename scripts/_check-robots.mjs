import { existsSync, readFileSync } from "node:fs";

const base = process.argv[2] || "http://localhost:3000";

/** Ranking slugs the chain actually grounded, so both branches get exercised. */
function groundedSlugs(limit = 3) {
  const file = "src/data/analysis/cache.json";
  if (!existsSync(file)) return [];
  const entries = JSON.parse(readFileSync(file, "utf8")).entries ?? [];
  return entries
    .filter((entry) => entry.provenance?.kind === "chain")
    .slice(0, limit)
    .map((entry) => entry.slug);
}

/** Column slugs from the committed store. */
function columnPaths(limit = 2) {
  const file = "src/data/posts/generated.json";
  if (!existsSync(file)) return [];
  const posts = JSON.parse(readFileSync(file, "utf8")).articles ?? [];
  return posts.slice(0, limit).map((post) => `/${post.channel}/${encodeURIComponent(post.slug)}`);
}

const paths = [
  `/search?q=${encodeURIComponent("배틀그라운드")}`,
  `/ranking/${encodeURIComponent("깜짝")}`,
  ...groundedSlugs().map((slug) => `/ranking/${encodeURIComponent(slug)}`),
  ...columnPaths(),
];

console.log("status  robots                         분석블록      h2   경로");
for (const path of paths) {
  try {
    const res = await fetch(base + path);
    const html = await res.text();
    const robots = html.match(/<meta name="robots" content="([^"]+)"/);
    const analysis = html.includes('id="today-analysis"');
    const h2 = (html.match(/<h2[^>]*>/g) ?? []).length;
    console.log(
      String(res.status).padEnd(7),
      (robots ? robots[1] : "(none)").padEnd(30),
      (analysis ? "있음" : "없음").padEnd(12),
      String(h2).padEnd(4),
      decodeURIComponent(path).slice(0, 52),
    );
  } catch (error) {
    console.log("ERR    ", decodeURIComponent(path), error.message);
  }
}
