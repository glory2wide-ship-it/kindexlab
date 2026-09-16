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
  const [gov, welfare] = await Promise.all([
    matchGov24Service(q),
    matchWelfareService(q),
  ]);
  const candidates = [gov, welfare].filter(Boolean) as PublicGrantRecord[];
  if (!candidates.length) {
    const biz = await searchBizSupport(q, { limit: 3 });
    return biz[0];
  }
  const normalized = q.replace(/\s+/g, "");
  candidates.sort((a, b) => {
    const score = (row: PublicGrantRecord) => {
      let s = 0;
      if (row.title.replace(/\s+/g, "").includes(normalized)) s += 3;
      if (row.deadline) s += 1;
      if (row.target) s += 1;
      if (row.documents) s += 1;
      if (row.source === "gov24") s += 0.5;
      return s;
    };
    return score(b) - score(a);
  });
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
