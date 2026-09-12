import { evaluateTrendsHealth } from "../src/lib/ingestion/health";

process.env.TRENDS_DATA_SOURCE = "mock";

const snapshot = {
  updatedAt: new Date().toISOString(),
  status: "open" as const,
  sources: [],
  indices: [],
  items: Array.from({ length: 500 }, (_, i) => ({ slug: `item-${i}`, name: `Item ${i}` })),
  scoreHistory: {},
};

const report = evaluateTrendsHealth({
  snapshot: snapshot as never,
  rejectMock: true,
});

console.log(
  JSON.stringify(
    {
      ok: report.ok,
      source: report.source,
      issues: report.issues.map((issue) => issue.code),
    },
    null,
    2,
  ),
);

if (report.ok || report.source !== "mock") {
  console.error("expected mock source to fail health when rejectMock=true");
  process.exit(1);
}
