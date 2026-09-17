import { searchBizSupport } from "@/lib/public-data/bizinfo";
import { matchGov24Service, searchGov24Services } from "@/lib/public-data/gov24";
import { hasDataGoKrKey } from "@/lib/public-data/key";
import type { PublicGrantRecord } from "@/lib/public-data/types";
import { matchWelfareService, searchCentralWelfare, searchLocalWelfare } from "@/lib/public-data/welfare";

function dedupeGrants(rows: PublicGrantRecord[]): PublicGrantRecord[] {
  const seen = new Set<string>();
  const out: PublicGrantRecord[] = [];
  for (const row of rows) {
    const key = `${row.source}:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Best single grant/welfare match for an entity detail pack. */
export async function matchPublicGrant(
  keyword: string,
): Promise<PublicGrantRecord | undefined> {
  if (!hasDataGoKrKey()) return undefined;
  const q = keyword.trim();
  if (!q) return undefined;
  const [gov, welfare, biz] = await Promise.all([
    matchGov24Service(q),
    matchWelfareService(q),
    searchBizSupport(q, { limit: 5 }).then((rows) => rows[0]).catch(() => undefined),
  ]);
  const candidates = [gov, welfare, biz].filter(Boolean) as PublicGrantRecord[];
  if (!candidates.length) return undefined;
  const normalized = q.replace(/\s+/g, "").replace(/^\[[^\]]+\]/, "");
  const richness = (row: PublicGrantRecord) => {
    let s = 0;
    const title = row.title.replace(/\s+/g, "");
    if (title === normalized) s += 12;
    if (title.includes(normalized) || normalized.includes(title)) s += 6;
    const tokens = normalized.match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
    for (const token of tokens) {
      if (title.includes(token)) s += Math.min(token.length, 4);
    }
    if (row.deadline && !/#/.test(row.deadline)) s += 3;
    if (row.target && !/#/.test(row.target)) s += 3;
    if (row.documents && !/#/.test(row.documents)) s += 2;
    if (row.howToApply && !/#/.test(row.howToApply)) s += 2;
    if (row.criteria && !/#/.test(row.criteria)) s += 1;
    if (row.summary) s += 1;
    if (row.source === "gov24") s += 1.5;
    if (row.source.startsWith("welfare")) s += 1;
    return s;
  };
  candidates.sort((a, b) => richness(b) - richness(a));
  return candidates[0];
}

/** Multi-source list for LIVE ranking / RAG. */
export async function searchPublicGrants(
  keyword: string,
  options: { limit?: number; includeBiz?: boolean } = {},
): Promise<PublicGrantRecord[]> {
  if (!hasDataGoKrKey() && !options.includeBiz) return [];
  const limit = options.limit ?? 12;
  const q = keyword.trim() || "지원금";
  const tasks: Promise<PublicGrantRecord[]>[] = [
    searchGov24Services(q, { perPage: limit }),
    searchCentralWelfare(q, { numOfRows: Math.min(8, limit) }),
    searchLocalWelfare(q, { numOfRows: Math.min(8, limit) }),
  ];
  if (options.includeBiz !== false) {
    tasks.push(searchBizSupport(q, { limit: Math.min(8, limit) }));
  }
  const chunks = await Promise.all(tasks);
  return dedupeGrants(chunks.flat()).slice(0, limit);
}
