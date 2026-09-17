import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { kstDateString } from "@/lib/briefing/dates";

export const ACTIVE_WINDOW_MS = 10 * 60 * 1000;

export type TrafficKind = "briefing" | "ranking" | "other";

export interface TrafficViewRow {
  slug: string;
  title: string;
  path: string;
  count: number;
}

export interface TrafficDayPayload {
  day: string;
  /** visitorId → lastSeen epoch ms */
  visitors: Record<string, number>;
  views: {
    briefing: Record<string, TrafficViewRow>;
    ranking: Record<string, TrafficViewRow>;
  };
}

export interface TrafficSnapshot {
  day: string;
  dailyVisitors: number;
  activeVisitors: number;
  activeWindowMinutes: number;
  topBriefings: TrafficViewRow[];
  topRankings: TrafficViewRow[];
  storage: "supabase" | "file" | "memory";
  note?: string;
}

const FILE_DIR = path.join("src", "data", "ops", "traffic");
const TABLE = "site_traffic_days";

const memory = new Map<string, TrafficDayPayload>();

function emptyDay(day: string): TrafficDayPayload {
  return { day, visitors: {}, views: { briefing: {}, ranking: {} } };
}

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function dayFile(day: string): string {
  return path.join(process.cwd(), FILE_DIR, `${day}.json`);
}

async function readFileDay(day: string): Promise<TrafficDayPayload | null> {
  try {
    return JSON.parse(await readFile(dayFile(day), "utf8")) as TrafficDayPayload;
  } catch {
    return null;
  }
}

async function writeFileDay(payload: TrafficDayPayload): Promise<boolean> {
  if (process.env.VERCEL === "1") return false;
  try {
    await mkdir(path.dirname(dayFile(payload.day)), { recursive: true });
    await writeFile(dayFile(payload.day), `${JSON.stringify(payload)}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function readSupabaseDay(day: string): Promise<TrafficDayPayload | null> {
  const config = supabaseConfig();
  if (!config) return null;
  try {
    const response = await fetch(
      `${config.url}/rest/v1/${TABLE}?day=eq.${encodeURIComponent(day)}&select=payload&limit=1`,
      {
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as { payload?: TrafficDayPayload }[];
    return rows[0]?.payload ?? null;
  } catch {
    return null;
  }
}

async function writeSupabaseDay(payload: TrafficDayPayload): Promise<boolean> {
  const config = supabaseConfig();
  if (!config) return false;
  try {
    const response = await fetch(`${config.url}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        day: payload.day,
        payload,
        updated_at: new Date().toISOString(),
      }),
    });
    return response.ok || response.status === 409;
  } catch {
    return false;
  }
}

async function loadDay(
  day: string,
): Promise<{ payload: TrafficDayPayload; storage: TrafficSnapshot["storage"] }> {
  const remote = await readSupabaseDay(day);
  if (remote) {
    memory.set(day, remote);
    return { payload: remote, storage: "supabase" };
  }
  const disk = await readFileDay(day);
  if (disk) {
    memory.set(day, disk);
    return { payload: disk, storage: "file" };
  }
  const cached = memory.get(day);
  if (cached) return { payload: cached, storage: "memory" };
  return {
    payload: emptyDay(day),
    storage: supabaseConfig() ? "supabase" : process.env.VERCEL === "1" ? "memory" : "file",
  };
}

async function saveDay(
  payload: TrafficDayPayload,
  preferred: TrafficSnapshot["storage"],
): Promise<TrafficSnapshot["storage"]> {
  memory.set(payload.day, payload);
  if (await writeSupabaseDay(payload)) return "supabase";
  if (await writeFileDay(payload)) return "file";
  return preferred === "supabase" ? "memory" : preferred;
}

function topRows(map: Record<string, TrafficViewRow>, limit: number): TrafficViewRow[] {
  return Object.values(map)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "ko"))
    .slice(0, limit);
}

function countActive(visitors: Record<string, number>, now = Date.now()): number {
  const cutoff = now - ACTIVE_WINDOW_MS;
  let count = 0;
  for (const lastSeen of Object.values(visitors)) {
    if (lastSeen >= cutoff) count += 1;
  }
  return count;
}

export function classifyPath(pathname: string): { kind: TrafficKind; slug: string | null } {
  const clean = pathname.split("?")[0] || "/";

  const briefing =
    clean.match(/^\/briefing\/([^/]+)\/?$/) ||
    clean.match(/^\/[^/]+\/briefing\/([^/]+)\/?$/);
  if (briefing?.[1] && briefing[1] !== "archive") {
    return { kind: "briefing", slug: decodeURIComponent(briefing[1]) };
  }

  const ranking =
    clean.match(/^\/ranking\/([^/]+)\/?$/) || clean.match(/^\/index\/([^/]+)\/?$/);
  if (ranking?.[1]) {
    return { kind: "ranking", slug: decodeURIComponent(ranking[1]) };
  }

  return { kind: "other", slug: null };
}

export async function recordTrafficBeacon(input: {
  visitorId: string;
  path: string;
  title?: string;
  /** true on route enter; false on heartbeat (presence only). */
  pageview?: boolean;
}): Promise<void> {
  const visitorId = input.visitorId.trim().slice(0, 80);
  if (!visitorId) return;
  const pathname = input.path.trim().slice(0, 300) || "/";
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/")) return;

  const day = kstDateString();
  const now = Date.now();
  const { payload, storage } = await loadDay(day);
  payload.visitors[visitorId] = now;

  if (input.pageview !== false) {
    const { kind, slug } = classifyPath(pathname);
    if ((kind === "briefing" || kind === "ranking") && slug) {
      const bucket = payload.views[kind];
      const existing = bucket[slug];
      const title =
        (input.title ?? "").replace(/\s*[·|].*$/, "").trim().slice(0, 160) ||
        existing?.title ||
        slug;
      bucket[slug] = {
        slug,
        title,
        path: pathname,
        count: (existing?.count ?? 0) + 1,
      };
    }
  }

  const staleBefore = now - 36 * 60 * 60 * 1000;
  for (const [id, lastSeen] of Object.entries(payload.visitors)) {
    if (lastSeen < staleBefore) delete payload.visitors[id];
  }

  await saveDay(payload, storage);
}

export async function getTrafficSnapshot(day = kstDateString()): Promise<TrafficSnapshot> {
  const { payload, storage } = await loadDay(day);
  return {
    day,
    dailyVisitors: Object.keys(payload.visitors).length,
    activeVisitors: countActive(payload.visitors),
    activeWindowMinutes: ACTIVE_WINDOW_MS / 60_000,
    topBriefings: topRows(payload.views.briefing, 8),
    topRankings: topRows(payload.views.ranking, 8),
    storage,
    note:
      storage === "memory"
        ? "내구성 저장소 없음 — Vercel에서는 Supabase에 site_traffic_days 테이블이 필요합니다."
        : storage === "file"
          ? "로컬 파일 저장 중 (배포 환경에서는 Supabase 권장)."
          : undefined,
  };
}

/** Local file traffic days (newest first). Supabase-only days are not listed. */
export async function listTrafficDays(limit = 30): Promise<string[]> {
  try {
    const { readdir } = await import("node:fs/promises");
    const names = await readdir(path.join(process.cwd(), FILE_DIR));
    return names
      .map((name) => name.match(/^(\d{4}-\d{2}-\d{2})\.json$/)?.[1])
      .filter((d): d is string => Boolean(d))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, limit);
  } catch {
    return [];
  }
}
