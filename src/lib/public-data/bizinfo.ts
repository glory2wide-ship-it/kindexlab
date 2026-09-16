import { fetchJson, fetchText } from "@/lib/ingestion/http";
import { bizinfoApiKey } from "@/lib/public-data/key";
import { cleanPublicText, clip, withServiceKey } from "@/lib/public-data/http";
import type { PublicGrantRecord } from "@/lib/public-data/types";

/**
 * 중소벤처기업부_중소기업 지원사업 공고 조회 서비스 (data.go.kr 15157820).
 * End Point: https://apis.data.go.kr/1421000/bizinfo
 * Operation: /pblancBsnsService
 *
 * Override with MSS_BIZINFO_API_BASE if the portal path changes.
 * Optional fallback: bizinfo.go.kr native key (BIZINFO_API_KEY).
 */
const DEFAULT_BIZINFO_OP =
  "https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService";

const MSS_CANDIDATES = [
  process.env.MSS_BIZINFO_API_BASE?.trim(),
  DEFAULT_BIZINFO_OP,
].filter(Boolean) as string[];

type PortalItem = Record<string, string | undefined>;

type PortalResponse = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      items?: { item?: PortalItem | PortalItem[] };
      totalCount?: string | number;
    };
  };
};

type BizinfoNativeItem = {
  title?: string;
  link?: string;
  seq?: string;
  author?: string;
  description?: string;
  hashtags?: string;
  categoryNameL?: string;
  reqstBeginEndDe?: string;
  trgetNm?: string;
  pblancUrl?: string;
};

type BizinfoNativeResponse = {
  jsonArray?: BizinfoNativeItem[];
  item?: BizinfoNativeItem[];
  channel?: { item?: BizinfoNativeItem | BizinfoNativeItem[] };
  reqErr?: string;
};

function fromPortal(row: PortalItem): PublicGrantRecord | undefined {
  const title = cleanPublicText(row.pblancNm || row.title);
  if (!title) return undefined;
  return {
    id: row.pblancId || title,
    title,
    agency: cleanPublicText(row.jrsdInsttNm || row.excInsttNm),
    summary: clip(cleanPublicText(row.bsnsSumryCn)),
    deadline: cleanPublicText(row.reqstBeginEndDe),
    target: cleanPublicText(row.trgetNm),
    howToApply: clip(cleanPublicText(row.reqstMthPapersCn)),
    phone: cleanPublicText(row.refrncNm),
    field: cleanPublicText(row.pldirSportRealmLclasCodeNm || row.hashtags),
    url: row.rceptEngnHmpgUrl || row.pblancUrl,
    source: "bizinfo",
  };
}

function fromNative(item: BizinfoNativeItem): PublicGrantRecord | undefined {
  const title = cleanPublicText(item.title);
  if (!title) return undefined;
  const id = item.seq || item.link || title;
  return {
    id,
    title,
    agency: cleanPublicText(item.author),
    summary: clip(cleanPublicText(item.description)),
    deadline: cleanPublicText(item.reqstBeginEndDe),
    target: cleanPublicText(item.trgetNm),
    field: cleanPublicText(item.categoryNameL || item.hashtags),
    url: item.pblancUrl || item.link,
    source: "bizinfo",
  };
}

function matchesKeyword(row: PublicGrantRecord, keyword: string): boolean {
  const needle = keyword.replace(/\s+/g, "");
  if (!needle) return true;
  const hay = [row.title, row.summary, row.field, row.target, row.agency]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, "");
  return hay.includes(needle) || row.title.includes(keyword);
}

async function searchBizinfoNative(
  keyword: string,
  limit: number,
): Promise<PublicGrantRecord[]> {
  const key = bizinfoApiKey();
  if (!key) return [];
  const url = new URL("https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do");
  url.searchParams.set("crtfcKey", key);
  url.searchParams.set("dataType", "json");
  url.searchParams.set("searchCnt", String(Math.max(limit, 20)));
  if (keyword.trim()) url.searchParams.set("hashtags", keyword.trim());
  try {
    const payload = await fetchJson<BizinfoNativeResponse>(url.toString());
    if (payload.reqErr) return [];
    const items =
      payload.jsonArray ||
      payload.item ||
      (Array.isArray(payload.channel?.item)
        ? payload.channel.item
        : payload.channel?.item
          ? [payload.channel.item]
          : []);
    return items
      .map(fromNative)
      .filter((row): row is PublicGrantRecord => Boolean(row))
      .filter((row) => matchesKeyword(row, keyword))
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function searchMssPortal(
  keyword: string,
  limit: number,
): Promise<PublicGrantRecord[]> {
  const q = keyword.trim();
  for (const base of MSS_CANDIDATES) {
    // Fetch a wider page then filter client-side when hashtags miss compounds.
    const url = withServiceKey(base, {
      pageNo: 1,
      numOfRows: Math.max(limit * 3, 30),
      dataType: "json",
      ...(q ? { hashtags: q } : {}),
    });
    if (!url) continue;
    try {
      const text = await fetchText(url, {
        headers: { Accept: "application/json,application/xml,*/*" },
      });
      if (/NO_OPENAPI_SERVICE_ERROR|등록되지 않은 서비스/i.test(text)) {
        continue;
      }
      if (/SERVICE_KEY|INVALID_REQUEST|UNAUTHORIZED|PERMISSION/i.test(text) && !/"00"/.test(text)) {
        continue;
      }
      const json = JSON.parse(text) as PortalResponse;
      const code = json.response?.header?.resultCode;
      if (code && code !== "00" && code !== "000") continue;
      const raw = json.response?.body?.items?.item;
      const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const mapped = rows
        .map(fromPortal)
        .filter((row): row is PublicGrantRecord => Boolean(row));
      if (!mapped.length) {
        // hashtags may return empty — retry without filter then match locally.
        if (q) {
          const wideUrl = withServiceKey(base, {
            pageNo: 1,
            numOfRows: Math.max(limit * 5, 50),
            dataType: "json",
          });
          if (!wideUrl) continue;
          const wideText = await fetchText(wideUrl, {
            headers: { Accept: "application/json,*/*" },
          });
          const wideJson = JSON.parse(wideText) as PortalResponse;
          const wideRaw = wideJson.response?.body?.items?.item;
          const wideRows = Array.isArray(wideRaw) ? wideRaw : wideRaw ? [wideRaw] : [];
          const filtered = wideRows
            .map(fromPortal)
            .filter((row): row is PublicGrantRecord => Boolean(row))
            .filter((row) => matchesKeyword(row, q))
            .slice(0, limit);
          if (filtered.length) return filtered;
        }
        continue;
      }
      const filtered = q ? mapped.filter((row) => matchesKeyword(row, q)) : mapped;
      return (filtered.length ? filtered : mapped).slice(0, limit);
    } catch {
      /* try next / native */
    }
  }
  return [];
}

/** SME / 창업 지원 공고 검색 (기업마당 data.go.kr). */
export async function searchBizSupport(
  keyword: string,
  options: { limit?: number } = {},
): Promise<PublicGrantRecord[]> {
  const limit = options.limit ?? 8;
  const portal = await searchMssPortal(keyword, limit);
  if (portal.length) return portal;
  return searchBizinfoNative(keyword, limit);
}
