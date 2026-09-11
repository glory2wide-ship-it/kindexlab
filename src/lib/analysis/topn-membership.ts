import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HeatmapAnalysisTarget } from "@/lib/analysis/heatmap-inventory";

const MEMBERSHIP_REL = path.join("src", "data", "analysis", "topn-membership.json");

export interface AnalysisTopNMembership {
  updatedAt: string;
  /** Slugs currently (or last) inside the overnight Top-N inventory. */
  bySlug: Record<
    string,
    {
      boardSlug: string;
      channel: string;
      seenAt: string;
    }
  >;
}

function membershipPath(): string {
  return path.join(process.cwd(), MEMBERSHIP_REL);
}

export async function readTopNMembership(): Promise<AnalysisTopNMembership> {
  try {
    const parsed = JSON.parse(
      await readFile(membershipPath(), "utf8"),
    ) as AnalysisTopNMembership;
    if (!parsed || typeof parsed.bySlug !== "object" || !parsed.bySlug) {
      return { updatedAt: "", bySlug: {} };
    }
    return parsed;
  } catch {
    return { updatedAt: "", bySlug: {} };
  }
}

export async function writeTopNMembership(
  membership: AnalysisTopNMembership,
): Promise<void> {
  if (process.env.VERCEL === "1") return;
  try {
    const file = membershipPath();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(membership, null, 2)}\n`, "utf8");
  } catch {
    /* read-only filesystem */
  }
}

/**
 * A slug re-enters Top-N when membership already has other entries (warm state)
 * and this slug was absent from the previous snapshot.
 * Cold start (empty membership) is not treated as mass re-entry.
 */
export function isAnalysisReentry(
  previous: AnalysisTopNMembership,
  slug: string,
): boolean {
  if (Object.keys(previous.bySlug).length === 0) return false;
  return !(slug in previous.bySlug);
}

/**
 * Merge the current run's Top-N targets into membership.
 * Boards not covered by this run keep their previous membership rows.
 */
export function mergeTopNMembership(
  previous: AnalysisTopNMembership,
  targets: HeatmapAnalysisTarget[],
  opts?: { channel?: string; boardSlug?: string; nowIso?: string },
): AnalysisTopNMembership {
  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const next: AnalysisTopNMembership = {
    updatedAt: nowIso,
    bySlug: { ...previous.bySlug },
  };

  const touched = new Set<string>();
  for (const target of targets) {
    if (opts?.channel && target.channel !== opts.channel) continue;
    if (opts?.boardSlug && target.boardSlug !== opts.boardSlug) continue;
    touched.add(`${target.channel}::${target.boardSlug}`);
  }

  for (const [slug, meta] of Object.entries(next.bySlug)) {
    const key = `${meta.channel}::${meta.boardSlug}`;
    if (touched.has(key)) {
      delete next.bySlug[slug];
    }
  }

  for (const target of targets) {
    if (opts?.channel && target.channel !== opts.channel) continue;
    if (opts?.boardSlug && target.boardSlug !== opts.boardSlug) continue;
    next.bySlug[target.entity.slug] = {
      boardSlug: target.boardSlug,
      channel: target.channel,
      seenAt: nowIso,
    };
  }

  return next;
}
