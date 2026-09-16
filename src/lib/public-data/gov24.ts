import { fetchPublicJson } from "@/lib/public-data/http";
import { cleanPublicText, clip } from "@/lib/public-data/http";
import type { PublicGrantRecord } from "@/lib/public-data/types";

const LIST = "https://api.odcloud.kr/api/gov24/v3/serviceList";
const DETAIL = "https://api.odcloud.kr/api/gov24/v3/serviceDetail";

type Gov24Row = Record<string, string | number | null | undefined>;

type Gov24ListResponse = {
  currentCount?: number;
  data?: Gov24Row[];
  totalCount?: number;
};

function pick(row: Gov24Row, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = cleanPublicText(String(value));
    if (text) return text;
  }
  return undefined;
}

function toRecord(row: Gov24Row): PublicGrantRecord | undefined {
  const id = pick(row, ["서비스ID", "SVC_ID", "svcId"]);
  const title = pick(row, ["서비스명"]);
  if (!id || !title) return undefined;
  // Always use the canonical 보조금24 detail URL. 온라인신청사이트URL often points
  // at third-party / unrelated hosts and previously broke trust (e.g. 자녀장려금).
  const detailHint = pick(row, ["상세조회URL"]);
  const url =
    detailHint && /gov\.kr/i.test(detailHint)
      ? detailHint
      : `https://www.gov.kr/portal/rcvfvrSvc/dtlEx/${id}`;
  return {
    id,
    title,
    agency: pick(row, ["소관기관명", "접수기관", "접수기관명"]),
    department: pick(row, ["부서명"]),
    summary: clip(pick(row, ["서비스목적요약", "서비스목적", "지원내용"])),
    target: pick(row, ["지원대상"]),
    criteria: pick(row, ["선정기준"]),
    content: pick(row, ["지원내용"]),
    howToApply: pick(row, ["신청방법"]),
    documents: pick(row, ["구비서류"]),
    deadline: pick(row, ["신청기한"]),
    url,
    phone: pick(row, ["전화문의", "문의처"]),
    field: pick(row, ["서비스분야", "지원유형"]),
    source: "gov24",
  };
}

/** Keyword search on 보조금24 service name (LIKE). */
export async function searchGov24Services(
  keyword: string,
  options: { page?: number; perPage?: number } = {},
): Promise<PublicGrantRecord[]> {
  const q = keyword.trim();
  if (!q) return [];
  const params: Record<string, string | number> = {
    page: options.page ?? 1,
    perPage: options.perPage ?? 10,
    returnType: "JSON",
  };
  // odcloud conditional: cond[필드::LIKE]=값
  params["cond[서비스명::LIKE]"] = q;
  const payload = await fetchPublicJson<Gov24ListResponse>(LIST, params);
  const rows = payload?.data ?? [];
  return rows.map(toRecord).filter((row): row is PublicGrantRecord => Boolean(row));
}

export async function fetchGov24ServiceDetail(
  serviceId: string,
): Promise<PublicGrantRecord | undefined> {
  const id = serviceId.trim();
  if (!id) return undefined;
  const payload = await fetchPublicJson<Gov24ListResponse>(DETAIL, {
    page: 1,
    perPage: 1,
    returnType: "JSON",
    [`cond[서비스ID::EQ]`]: id,
  });
  const row = payload?.data?.[0];
  if (!row) return undefined;
  const base = toRecord({ ...row, 서비스ID: id });
  if (!base) return undefined;
  return {
    ...base,
    documents: pick(row, ["구비서류", "본인확인구비서류"]) || base.documents,
    howToApply: pick(row, ["신청방법"]) || base.howToApply,
    phone: pick(row, ["문의처", "전화문의"]) || base.phone,
    summary: clip(pick(row, ["서비스목적", "서비스목적요약", "지원내용"])) || base.summary,
    target: pick(row, ["지원대상"]) || base.target,
    criteria: pick(row, ["선정기준"]) || base.criteria,
    content: pick(row, ["지원내용"]) || base.content,
    deadline: pick(row, ["신청기한"]) || base.deadline,
    // Keep canonical gov.kr URL from toRecord — never replace with 온라인신청사이트URL.
    url: base.url,
  };
}

/** Best match: list hit whose title overlaps keyword, then detail. */
export async function matchGov24Service(
  keyword: string,
): Promise<PublicGrantRecord | undefined> {
  const variants = keywordVariants(keyword);
  let list: PublicGrantRecord[] = [];
  for (const variant of variants) {
    list = await searchGov24Services(variant, { perPage: 8 });
    if (list.length) break;
  }
  if (!list.length) return undefined;
  const normalized = keyword.replace(/\s+/g, "").replace(/^\[[^\]]+\]/, "");
  const ranked = [...list]
    .map((row) => {
      const title = row.title.replace(/\s+/g, "");
      let score = 0;
      if (title === normalized) score += 10;
      if (title.includes(normalized) || normalized.includes(title)) score += 5;
      // Token overlap (자녀장려금 ↔ 근로·자녀장려금)
      const tokens = normalized.match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
      for (const token of tokens) {
        if (title.includes(token)) score += Math.min(token.length, 4);
      }
      return { row, score };
    })
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score);
  const top = ranked[0]?.row;
  if (!top) return undefined;
  const detail = await fetchGov24ServiceDetail(top.id);
  return detail ?? top;
}

function keywordVariants(keyword: string): string[] {
  const q = keyword.trim();
  if (!q) return [];
  const out = [q];
  // Drop bracket labels: "[복지부] 청년도약계좌" → "청년도약계좌"
  const unbracket = q.replace(/^\[[^\]]+\]\s*/, "").trim();
  if (unbracket && unbracket !== q) out.push(unbracket);
  // Meaningful tokens (2+ chars)
  const tokens = unbracket.split(/[\s_/·\-]+/).filter((t) => t.length >= 2);
  for (const token of tokens) {
    if (!out.includes(token)) out.push(token);
  }
  // Progressive prefixes for compound names (청년도약계좌 → 청년도약 → 청년)
  if (unbracket.length >= 6) {
    out.push(unbracket.slice(0, Math.min(6, unbracket.length)));
    out.push(unbracket.slice(0, 4));
  }
  return [...new Set(out)].slice(0, 5);
}
