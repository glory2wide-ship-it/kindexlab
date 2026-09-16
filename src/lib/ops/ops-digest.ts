import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GeminiUsageSnapshot } from "@/lib/ops/gemini-usage";
import {
  countByStatus,
  type GenerationReport,
  type GenerationReportRow,
  type ReportRowStatus,
} from "@/lib/ops/generation-report";
import { isPostChannel, POST_CHANNELS } from "@/lib/posts/channels";

export type OpsDigestKind = "briefings" | "heatmap-analysis" | "board-refresh";

export interface OpsDigestItem {
  /** Article / keyword title. */
  name: string;
  /** Channel id when known (entertainment, politics, …). */
  category: string;
  /** Korean label for admin tables. */
  categoryLabel: string;
  status: ReportRowStatus;
  /** Allocated Gemini API cost in KRW for this row. */
  estimatedKrw: number;
  /** briefings | heatmap-analysis */
  pipeline: string;
  /** deep-dive / main / boardSlug, etc. */
  kind?: string;
  meta?: string;
  reason?: string;
}

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
  /** Per-article rows for admin 글별 / 카테고리별 tables. */
  items?: OpsDigestItem[];
}

export interface OpsCategorySummary {
  category: string;
  categoryLabel: string;
  ok: number;
  fail: number;
  skip: number;
  estimatedKrw: number;
}

/** Product article families shown on /admin cost tables. */
export type OpsArticleType = "today-briefing" | "today-insight" | "today-analysis";

export interface OpsArticleTypeSummary {
  type: OpsArticleType;
  typeLabel: string;
  ok: number;
  fail: number;
  skip: number;
  estimatedKrw: number;
}

export const OPS_ARTICLE_TYPE_LABEL: Record<OpsArticleType, string> = {
  "today-briefing": "투데이 브리핑",
  "today-insight": "투데이 인사이트",
  "today-analysis": "오늘의 분석",
};

const OPS_ARTICLE_TYPE_ORDER: OpsArticleType[] = [
  "today-briefing",
  "today-insight",
  "today-analysis",
];

export function articleTypeForItem(item: Pick<OpsDigestItem, "pipeline" | "kind" | "meta">): OpsArticleType | null {
  const pipeline = item.pipeline || "";
  if (pipeline.includes("heatmap")) return "today-analysis";

  const kind = (item.kind || "").trim();
  const meta = item.meta || "";
  if (kind === "main" || /(^| · )main( · |$)/.test(meta)) return "today-briefing";
  if (kind === "deep-dive" || meta.includes("deep-dive")) return "today-insight";
  if (pipeline.includes("briefing")) {
    // Briefing pipeline without a clear kind — treat as insight (majority deep-dives).
    return "today-insight";
  }
  return null;
}

const OPS_DAILY_DIR = path.join(process.cwd(), "src", "data", "ops", "daily");
const ARTIFACTS_DIR = path.join(process.cwd(), "artifacts", "generation-reports");

const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(
  POST_CHANNELS.map((row) => [row.id, row.label]),
);

function kstToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function categoryLabelFor(category: string): string {
  if (CHANNEL_LABEL[category]) return CHANNEL_LABEL[category]!;
  if (category === "unknown" || !category) return "미분류";
  return category;
}

/**
 * Parse channel (+ optional kind) from generation-report meta.
 * Heatmap: `culture/bestseller-surge-index`
 * Briefings: `entertainment · deep-dive · 엔터 데스크`
 */
export function parseItemCategory(meta?: string): { category: string; kind?: string } {
  if (!meta?.trim()) return { category: "unknown" };
  const trimmed = meta.trim();
  if (trimmed.includes("/")) {
    const [channel, ...rest] = trimmed.split("/");
    const category = channel?.trim() || "unknown";
    return {
      category: isPostChannel(category) ? category : category || "unknown",
      kind: rest.join("/") || undefined,
    };
  }
  if (trimmed.includes(" · ")) {
    const parts = trimmed.split(" · ").map((part) => part.trim()).filter(Boolean);
    const category = parts[0] || "unknown";
    return {
      category: isPostChannel(category) ? category : category,
      kind: parts[1],
    };
  }
  if (isPostChannel(trimmed)) return { category: trimmed };
  return { category: "unknown", kind: trimmed };
}

function allocateItemCosts(
  rows: GenerationReportRow[],
  totalKrw: number,
): number[] {
  const weights = rows.map((row) => {
    if (row.status === "skip") return 0;
    if (typeof row.costUsd === "number" && row.costUsd > 0) return row.costUsd;
    return 1;
  });
  const weightSum = weights.reduce((acc, weight) => acc + weight, 0);
  if (weightSum <= 0 || totalKrw <= 0) return rows.map(() => 0);

  const raw = weights.map((weight) => (weight / weightSum) * totalKrw);
  const rounded = raw.map((value) => Math.round(value * 100) / 100);
  // Fix rounding drift on the last billable row.
  const billableIdx = rows
    .map((row, index) => (row.status === "skip" ? -1 : index))
    .filter((index) => index >= 0);
  if (billableIdx.length) {
    const last = billableIdx[billableIdx.length - 1]!;
    const drift =
      Math.round((totalKrw - rounded.reduce((acc, value) => acc + value, 0)) * 100) / 100;
    rounded[last] = Math.round(((rounded[last] ?? 0) + drift) * 100) / 100;
  }
  return rounded;
}

export function itemsFromGenerationReport(
  report: GenerationReport,
  kind: OpsDigestKind,
): OpsDigestItem[] {
  if (kind === "board-refresh") return [];
  const rows = report.sections.flatMap((section) => section.rows);
  // Overnight generation is Gemini Batch (−50%). Prefer batchKrw so item rows
  // never inherit Live list prices when both buckets are present.
  const totalKrw = report.cost?.batchKrw || report.cost?.estimatedKrw || 0;
  const costs = allocateItemCosts(rows, totalKrw);
  return rows.map((row, index) => {
    const parsed = parseItemCategory(row.meta);
    return {
      name: row.name,
      category: parsed.category,
      categoryLabel: categoryLabelFor(parsed.category),
      status: row.status,
      estimatedKrw: costs[index] ?? 0,
      pipeline: kind,
      kind: parsed.kind,
      meta: row.meta,
      reason: row.reason,
    };
  });
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
    items: itemsFromGenerationReport(report, kind),
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

function digestFileName(digest: OpsDigest): string {
  const stamp = digest.generatedAt.replace(/[:.]/g, "-");
  return `${digest.editionDate}-${digest.kind}-${stamp}.json`;
}

/** Drop older same-edition/same-kind digests so partial checkpoints do not stack. */
async function pruneOlderDigests(digest: OpsDigest, keepFile: string): Promise<void> {
  let names: string[] = [];
  try {
    names = await readdir(OPS_DAILY_DIR);
  } catch {
    return;
  }
  const prefix = `${digest.editionDate}-${digest.kind}-`;
  await Promise.all(
    names
      .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
      .map((name) => path.join(OPS_DAILY_DIR, name))
      .filter((file) => file !== keepFile)
      .map(async (file) => {
        try {
          await unlink(file);
        } catch {
          /* ignore race */
        }
      }),
  );
}

function pruneOlderDigestsSync(digest: OpsDigest, keepFile: string): void {
  if (!existsSync(OPS_DAILY_DIR)) return;
  const prefix = `${digest.editionDate}-${digest.kind}-`;
  for (const name of readdirSync(OPS_DAILY_DIR)) {
    if (!name.startsWith(prefix) || !name.endsWith(".json")) continue;
    const file = path.join(OPS_DAILY_DIR, name);
    if (file === keepFile) continue;
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

export async function persistOpsDigest(
  digest: OpsDigest,
  options?: { replaceSameKind?: boolean },
): Promise<string> {
  await mkdir(OPS_DAILY_DIR, { recursive: true });
  const file = path.join(OPS_DAILY_DIR, digestFileName(digest));
  await writeFile(file, `${JSON.stringify(digest, null, 2)}\n`, "utf8");
  if (options?.replaceSameKind !== false && digest.kind !== "board-refresh") {
    await pruneOlderDigests(digest, file);
  }
  return file;
}

/**
 * Sync persist for SIGTERM/SIGINT handlers — async writes can be killed before
 * they flush, which left /admin without 오늘의 분석 after the 6h cancel (2026-09-16).
 */
export function persistOpsDigestSync(
  digest: OpsDigest,
  options?: { replaceSameKind?: boolean },
): string {
  mkdirSync(OPS_DAILY_DIR, { recursive: true });
  const file = path.join(OPS_DAILY_DIR, digestFileName(digest));
  writeFileSync(file, `${JSON.stringify(digest, null, 2)}\n`, "utf8");
  if (options?.replaceSameKind !== false && digest.kind !== "board-refresh") {
    pruneOlderDigestsSync(digest, file);
  }
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
      const kind: OpsDigestKind =
        report.pipeline.includes("heatmap")
          ? "heatmap-analysis"
          : report.pipeline.includes("board")
            ? "board-refresh"
            : "briefings";
      out.push(digestFromGenerationReport(report, kind));
    }
  }
  return out;
}

/**
 * Briefings / heatmap leave one authoritative digest per kind (latest wins).
 * Board refreshes may run several times a day — keep them all.
 */
export function dedupeDigestsForAdmin(digests: OpsDigest[]): OpsDigest[] {
  const boards = digests.filter((row) => row.kind === "board-refresh");
  const generation = digests.filter((row) => row.kind !== "board-refresh");
  const latestByKind = new Map<OpsDigestKind, OpsDigest>();
  for (const row of [...generation].sort((a, b) => a.generatedAt.localeCompare(b.generatedAt))) {
    latestByKind.set(row.kind, row);
  }
  return [...latestByKind.values(), ...boards].sort((a, b) =>
    b.generatedAt.localeCompare(a.generatedAt),
  );
}

export async function loadOpsDigestsForDate(editionDate = kstToday()): Promise<OpsDigest[]> {
  const fromOps = await loadDigestsFromDir(OPS_DAILY_DIR, editionDate);
  const fromArtifacts = await loadDigestsFromDir(ARTIFACTS_DIR, editionDate);
  const merged = [...fromOps, ...fromArtifacts];
  const byKey = new Map<string, OpsDigest>();
  for (const row of merged) {
    byKey.set(`${row.kind}:${row.generatedAt}`, row);
  }
  return dedupeDigestsForAdmin([...byKey.values()]);
}

function rollupCategories(items: OpsDigestItem[]): OpsCategorySummary[] {
  const map = new Map<string, OpsCategorySummary>();
  for (const item of items) {
    const key = item.category || "unknown";
    const current = map.get(key) ?? {
      category: key,
      categoryLabel: item.categoryLabel || categoryLabelFor(key),
      ok: 0,
      fail: 0,
      skip: 0,
      estimatedKrw: 0,
    };
    if (item.status === "ok") current.ok += 1;
    else if (item.status === "fail") current.fail += 1;
    else current.skip += 1;
    current.estimatedKrw = Math.round((current.estimatedKrw + item.estimatedKrw) * 100) / 100;
    map.set(key, current);
  }
  const channelOrder = POST_CHANNELS.map((row) => row.id);
  return [...map.values()].sort((a, b) => {
    const ai = channelOrder.indexOf(a.category as (typeof channelOrder)[number]);
    const bi = channelOrder.indexOf(b.category as (typeof channelOrder)[number]);
    const aRank = ai === -1 ? 999 : ai;
    const bRank = bi === -1 ? 999 : bi;
    if (aRank !== bRank) return aRank - bRank;
    return b.estimatedKrw - a.estimatedKrw;
  });
}

function rollupArticleTypes(items: OpsDigestItem[]): OpsArticleTypeSummary[] {
  const map = new Map<OpsArticleType, OpsArticleTypeSummary>();
  for (const type of OPS_ARTICLE_TYPE_ORDER) {
    map.set(type, {
      type,
      typeLabel: OPS_ARTICLE_TYPE_LABEL[type],
      ok: 0,
      fail: 0,
      skip: 0,
      estimatedKrw: 0,
    });
  }
  for (const item of items) {
    const type = articleTypeForItem(item);
    if (!type) continue;
    const current = map.get(type)!;
    if (item.status === "ok") current.ok += 1;
    else if (item.status === "fail") current.fail += 1;
    else current.skip += 1;
    current.estimatedKrw = Math.round((current.estimatedKrw + item.estimatedKrw) * 100) / 100;
  }
  return OPS_ARTICLE_TYPE_ORDER.map((type) => map.get(type)!);
}

export function summarizeDay(digests: OpsDigest[]) {
  const generation = digests.filter((row) => row.kind !== "board-refresh");
  const boards = digests.filter((row) => row.kind === "board-refresh");
  const sum = (rows: OpsDigest[], pick: (row: OpsDigest) => number) =>
    rows.reduce((acc, row) => acc + pick(row), 0);

  const items = generation.flatMap((digest) =>
    (digest.items ?? []).map((item) => ({
      ...item,
      pipeline: item.pipeline || digest.kind,
      categoryLabel: item.categoryLabel || categoryLabelFor(item.category),
    })),
  );

  // Prefer higher-cost / fail rows first for ops scanning.
  const byItem = [...items].sort((a, b) => {
    if (a.status !== b.status) {
      const rank = { fail: 0, ok: 1, skip: 2 } as const;
      return rank[a.status] - rank[b.status];
    }
    return b.estimatedKrw - a.estimatedKrw || a.name.localeCompare(b.name, "ko");
  });

  const batchOrEstimated = (row: OpsDigest) =>
    row.batchKrw > 0 ? row.batchKrw : row.estimatedKrw;

  return {
    editionDate: digests[0]?.editionDate ?? kstToday(),
    generationOk: sum(generation, (row) => row.ok),
    generationFail: sum(generation, (row) => row.fail),
    generationSkip: sum(generation, (row) => row.skip),
    /** Admin 글생성 API 비용 — Gemini Batch (−50%) 기준. */
    generationKrw: sum(generation, batchOrEstimated),
    generationBatchKrw: sum(generation, (row) => row.batchKrw),
    generationLiveKrw: sum(generation, (row) => row.liveKrw),
    boardRefreshKrw: sum(boards, batchOrEstimated),
    boardRefreshOk: sum(boards, (row) => row.ok),
    boardRefreshFail: sum(boards, (row) => row.fail),
    boardsRefreshed: sum(boards, (row) => row.boardsRefreshed ?? row.ok),
    byItem,
    byCategory: rollupCategories(byItem),
    byArticleType: rollupArticleTypes(byItem),
    digests,
  };
}
