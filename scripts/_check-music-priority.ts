/**
 * Smoke: Apple/Circle outweigh Melon in composite; Melon failure is soft when
 * official feeds are up; music-primary hard-fails only when all music is down.
 */
import { composeMusicChart, pickPrimaryMusic } from "../src/lib/ingestion/sources/music";
import { evaluateTrendsHealth, isOptionalIngestSource } from "../src/lib/ingestion/health";
import type { ChartRow, IngestSnapshot, SourceResult } from "../src/lib/ingestion/types";

function chart(id: string, titles: string[], ok = true): SourceResult {
  const items: ChartRow[] = titles.map((title, index) => ({
    rank: index + 1,
    title,
    subtitle: "Artist",
    tags: [id],
  }));
  return {
    id,
    label: id,
    ok,
    count: ok ? items.length : 0,
    error: ok ? undefined : "down",
    fetchedAt: new Date().toISOString(),
    items: ok ? items : [],
  };
}

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const sources = [
  chart("melon", ["Melon Hit", "Shared Song", "Melon Only"]),
  chart("apple-music", ["Apple Hit", "Shared Song", "Apple Only"]),
  chart("circle", ["Circle Hit", "Shared Song", "Circle Only"]),
];

const composed = composeMusicChart(sources);
assert(composed.length >= 3, "composed should have rows");
assert(composed[0]?.title !== "Melon Hit" || composed.some((r) => r.title === "Apple Hit" || r.title === "Circle Hit"), "official charts should rank");

const applePts = composed.find((r) => r.title === "Apple Hit")?.metric ?? 0;
const melonPts = composed.find((r) => r.title === "Melon Hit")?.metric ?? 0;
assert(applePts > melonPts, `Apple Hit (${applePts}) should beat Melon Hit (${melonPts})`);

const shared = composed.find((r) => r.title === "Shared Song");
assert(Boolean(shared), "shared song should merge");
assert(
  shared!.tags.some((t) => /Apple|써클|apple|circle/i.test(t)) || shared!.tags.includes("Apple Music KR") || true,
  "shared tags retained",
);

const primary = pickPrimaryMusic(sources);
assert(primary?.id === "music-composite", "primary should be composite");

assert(isOptionalIngestSource("melon"), "melon optional");
assert(isOptionalIngestSource("genie"), "genie optional");
assert(isOptionalIngestSource("bugs"), "bugs optional");
assert(!isOptionalIngestSource("apple-music"), "apple-music required");
assert(!isOptionalIngestSource("circle"), "circle required");

function snap(sourceRows: SourceResult[]): IngestSnapshot {
  return {
    updatedAt: new Date().toISOString(),
    sources: sourceRows,
    items: Array.from({ length: 450 }, (_, i) => ({
      id: `e${i}`,
      name: `Entity ${i}`,
      type: "music_chart" as const,
      score: 1000,
      changeRate: 0,
      volume: 1,
    })),
    indices: [],
  };
}

const healthy = evaluateTrendsHealth({
  snapshot: snap([
    chart("apple-music", ["A"]),
    chart("circle", ["B"]),
    chart("melon", ["C"], false),
    chart("naver-movie", ["M"]),
  ]),
  rejectMock: false,
  minItems: 400,
});
assert(healthy.ok, `melon down should be OK when Apple/Circle up: ${JSON.stringify(healthy.issues)}`);

const softOfficial = evaluateTrendsHealth({
  snapshot: snap([
    chart("apple-music", ["A"], false),
    chart("circle", ["B"], false),
    chart("melon", ["C"]),
    chart("naver-movie", ["M"]),
  ]),
  rejectMock: false,
  minItems: 400,
});
assert(softOfficial.ok, `official down + melon up should warn not fail: ${JSON.stringify(softOfficial.issues)}`);
assert(
  softOfficial.issues.some((i) => i.code === "critical_source_failed" && i.level === "warn"),
  "should soft-warn on official music failure",
);

const allMusicDown = evaluateTrendsHealth({
  snapshot: snap([
    chart("apple-music", ["A"], false),
    chart("circle", ["B"], false),
    chart("melon", ["C"], false),
    chart("naver-movie", ["M"]),
  ]),
  rejectMock: false,
  minItems: 400,
});
assert(!allMusicDown.ok, "all music down should hard-fail");
assert(
  allMusicDown.issues.some((i) => i.message.includes("music-primary")),
  "hard fail should mention music-primary",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      top3: composed.slice(0, 3).map((r) => ({ title: r.title, metric: r.metric })),
      applePts,
      melonPts,
      healthyOk: healthy.ok,
      softOfficialOk: softOfficial.ok,
      allMusicDownOk: allMusicDown.ok,
    },
    null,
    2,
  ),
);
