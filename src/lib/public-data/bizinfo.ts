import { fetchJson, fetchText } from "@/lib/ingestion/http";
import { bizinfoApiKey } from "@/lib/public-data/key";
import { cleanPublicText, clip, withServiceKey } from "@/lib/public-data/http";
import type { PublicGrantRecord } from "@/lib/public-data/types";

/**
 * 중소벤처기업부_중소기업 지원사업 공고 조회 서비스(data.go.kr 15157820).
 * 포털 Swagger 엔드포인트가 기관별로 바뀌어 BASE를 env로 덮을 수 있게 둠.
 * 기본 후보가 실패하면 기업마당 네이티브(BIZINFO_API_KEY)로 폴백.
 */
const MSS_CANDIDATES = [
  process.env.MSS_BIZINFO_API_BASE?.trim(),
  "https://apis.data.go.kr/B552735/mssBizPblancService/getPblancList",
  "https://apis.data.go.kr/1421000/mssBizService_v2/getPblancList",
].filter(Boolean) as string[];

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
    const needle = keyword.replace(/\s+/g, "");
    return items
      .map(fromNative)
      .filter((row): row is PublicGrantRecord => Boolean(row))
      .filter((row) =>
        !needle
          ? true
          : row.title.replace(/\s+/g, "").includes(needle) ||
            (row.summary ?? "").replace(/\s+/g, "").includes(needle) ||
            (row.field ?? "").includes(keyword),
      )
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function searchMssPortal(
  keyword: string,
  limit: number,
): Promise<PublicGrantRecord[]> {
  for (const base of MSS_CANDIDATES) {
    const url = withServiceKey(base, {
      pageNo: 1,
      numOfRows: limit,
      _type: "json",
      searchWrd: keyword || undefined,
      keyword: keyword || undefined,
    });
    if (!url) continue;
    try {
      const text = await fetchText(url, {
        headers: { Accept: "application/json,application/xml,*/*" },
      });
      if (/NO_OPENAPI_SERVICE_ERROR|등록되지 않은 서비스|SERVICE_KEY/i.test(text)) {
        continue;
      }
      // Soft-parse common JSON shapes; ignore if unusable.
      try {
        const json = JSON.parse(text) as Record<string, unknown>;
        const body = (json.response as { body?: { items?: { item?: unknown } } })?.body;
        const raw = body?.items?.item;
        const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
        const mapped: PublicGrantRecord[] = [];
        for (const row of rows) {
          if (!row || typeof row !== "object") continue;
          const r = row as Record<string, string>;
          const title = cleanPublicText(r.pblancNm || r.title || r.bsnsNm);
          if (!title) continue;
          mapped.push({
            id: r.pblancId || r.seq || title,
            title,
            agency: cleanPublicText(r.jrsdInsttNm || r.author),
            summary: clip(cleanPublicText(r.bsnsSumryCn || r.description)),
            deadline: cleanPublicText(r.reqstBeginEndDe || r.rceptPd),
            target: cleanPublicText(r.trgetNm),
            url: r.pblancUrl || r.link,
            source: "bizinfo",
          });
        }
        if (mapped.length) return mapped.slice(0, limit);
      } catch {
        /* not JSON */
      }
    } catch {
      /* try next */
    }
  }
  return [];
}

/** SME / 창업 지원 공고 검색. */
export async function searchBizSupport(
  keyword: string,
  options: { limit?: number } = {},
): Promise<PublicGrantRecord[]> {
  const limit = options.limit ?? 8;
  const portal = await searchMssPortal(keyword, limit);
  if (portal.length) return portal;
  return searchBizinfoNative(keyword, limit);
}
