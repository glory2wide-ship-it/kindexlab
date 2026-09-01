const base = process.argv[2] || "http://localhost:3000";

const paths = [
  `/search?q=${encodeURIComponent("배틀그라운드")}`,
  "/search",
  `/ranking/${encodeURIComponent("깜짝")}`,
  `/entertainment/2026-08-30-${encodeURIComponent("사이다")}`,
];

for (const path of paths) {
  try {
    const res = await fetch(base + path);
    const html = await res.text();
    const robots = html.match(/<meta name="robots" content="([^"]+)"/);
    const title = html.match(/<title>([^<]*)<\/title>/);
    console.log(
      String(res.status).padEnd(4),
      (robots ? `robots=${robots[1]}` : "robots=(none)").padEnd(30),
      (title ? title[1] : "").slice(0, 34).padEnd(36),
      decodeURIComponent(path).slice(0, 46),
    );
  } catch (error) {
    console.log("ERR ", decodeURIComponent(path), error.message);
  }
}
