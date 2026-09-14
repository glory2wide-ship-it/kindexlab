import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GeminiUsageSnapshot } from "@/lib/ops/gemini-usage";
import { countByStatus, type GenerationReport } from "@/lib/ops/generation-report";

export type OpsDigestKind = "briefings" | "heatmap-analysis" | "board-refresh";

export interface OpsDigest {
  kind: OpsDigestKind;
  editionDate: string;
  pipeline: string;
  generatedAt: string;
  ok: number;
  fail: number;
  skip: number;
  total: number;
  estimatedKrw: number;
  liveKrw: number;
  batchKrw: number;
  tokens: number;
  calls: number;
  model?: string;
  notes?: string[];
  /** Board refresh: how many boards were refreshed this run. */
  boardsRefreshed?: number;
}

const OPS_DAILY_DIR = path.join(process.cwd(), "src", "data", "ops", "daily");
const ARTIFACTS_DIR = path.join(process.cwd(), "artifacts", "generation-reports");

function kstToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function digestFromGenerationReport(
  report: GenerationReport,
  kind: OpsDigestKind,
): OpsDigest {
  const rows = report.sections.flatMap((section) => section.rows);
  const counts = countByStatus(rows);
  const cost = report.cost;
  return {
    kind,
    editionDate: report.editionDate,
    pipeline: report.pipeline,
    generatedAt: report.generatedAt,
    ok: counts.ok,
    fail: counts.fail,
    skip: counts.skip,
    total: counts.total,
    estimatedKrw: cost?.estimatedKrw ?? 0,
    liveKrw: cost?.liveKrw ?? 0,
    batchKrw: cost?.batchKrw ?? 0,
    tokens: cost?.totalTokens ?? 0,
    calls: cost?.calls ?? 0,
    model: cost?.model,
    notes: report.notes,
  };
}

export function digestFromBoardRefresh(input: {
  editionDate: string;
  generatedAt: string;
  boardsRefreshed: number;
  ok: number;
  fail: number;
  cost?: GeminiUsageSnapshot;
  notes?: string[];
}): OpsDigest {
  const cost = input.cost;
  return {
    kind: "board-refresh",
    editionDate: input.editionDate,
    pipeline: "board-refresh",
    generatedAt: input.generatedAt,
    ok: input.ok,
    fail: input.fail,
    skip: 0,
    total: input.ok + input.fail,
    estimatedKrw: cost?.estimatedKrw ?? 0,
    liveKrw: cost?.liveKrw ?? 0,
    batchKrw: cost?.batchKrw ?? 0,
    tokens: cost?.totalTokens ?? 0,
    calls: cost?.calls ?? 0,
    model: cost?.model,
    notes: input.notes,
    boardsRefreshed: input.boardsRefreshed,
  };
}

export async function persistOpsDigest(digest: OpsDigest): Promise<string> {
  await mkdir(OPS_DAILY_DIR, { recursive: true });
  const stamp = digest.generatedAt.replace(/[:.]/g, "-");
  const file = path.join(OPS_DAILY_DIR, `${digest.editionDate}-${digest.kind}-${stamp}.json`);
  await writeFile(file, `${JSON.stringify(digest, null, 2)}\n`, "utf8");
  return file;
}

async function readJsonFile<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function loadDigestsFromDir(dir: string, editionDate: string): Promise<OpsDigest[]> {
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const out: OpsDigest[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    if (!name.startsWith(editionDate) && !name.includes(editionDate)) continue;
    const parsed = await readJsonFile<OpsDigest | GenerationReport>(path.join(dir, name));
    if (!parsed) continue;
    if ("kind" in parsed && "editionDate" in parsed && "ok" in parsed) {
      out.push(parsed as OpsDigest);
      continue;
    }
    if ("pipeline" in parsed && "sections" in parsed) {
      const report = parsed as GenerationReport;
      const kind: OpsDigestKind = report.pipeline.includes("heatmap")
        ? "heatmap-analysis"
        : report.pipeline.includes("board")
          ? "board-refresh"
          : "briefings";
      out.push(digestFromGenerationReport(report, kind));
    }
  }
  return out;
}

export async function loadOpsDigestsForDate(editionDate = kstToday()): Promise<OpsDigest[]> {
  const fromOps = await loadDigestsFromDir(OPS_DAILY_DIR, editionDate);
  const fromArtifacts = await loadDigestsFromDir(ARTIFACTS_DIR, editionDate);
  const merged = [...fromOps, ...fromArtifacts];
  const byKey = new Map<string, OpsDigest>();
  for (const row of merged) {
    byKey.set(`${row.kind}:${row.generatedAt}`, row);
  }
  return [...byKey.values()].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export function summarizeDay(digests: OpsDigest[]) {
  const generation = digests.filter((row) => row.kind !== "board-refresh");
  const boards = digests.filter((row) => row.kind === "board-refresh");
  const sum = (rows: OpsDigest[], pick: (row: OpsDigest) => number) =>
    rows.reduce((acc, row) => acc + pick(row), 0);
  return {
    editionDate: digests[0]?.editionDate ?? kstToday(),
    generationOk: sum(generation, (row) => row.ok),
    generationFail: sum(generation, (row) => row.fail),
    generationSkip: sum(generation, (row) => row.skip),
    generationKrw: sum(generation, (row) => row.estimatedKrw),
    boardRefreshKrw: sum(boards, (row) => row.estimatedKrw),
    boardRefreshOk: sum(boards, (row) => row.ok),
    boardRefreshFail: sum(boards, (row) => row.fail),
    boardsRefreshed: sum(boards, (row) => row.boardsRefreshed ?? row.ok),
    digests,
  };
}
