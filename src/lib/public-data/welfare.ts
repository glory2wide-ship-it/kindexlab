import {
  cleanPublicText,
  clip,
  fetchPublicText,
  xmlServList,
  xmlTag,
} from "@/lib/public-data/http";
import type { PublicGrantRecord } from "@/lib/public-data/types";

const CENTRAL_LIST =
  "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001";
const CENTRAL_DETAIL =
  "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfaredetailedV001";
const LOCAL_LIST =
  "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist";
const LOCAL_DETAIL =
  "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfaredetailed";

function parseListXml(
  xml: string,
  source: PublicGrantRecord["source"],
): PublicGrantRecord[] {
  const out: PublicGrantRecord[] = [];
  for (const block of xmlServList(xml)) {
    const id = xmlTag(block, "servId") || xmlTag(block, "servID");
    const title = cleanPublicText(xmlTag(block, "servNm"));
    if (!id || !title) continue;
    const agency =
      cleanPublicText(xmlTag(block, "jurMnofNm")) ||
      cleanPublicText(xmlTag(block, "ctpvNm")) ||
      cleanPublicText(xmlTag(block, "sggNm"));
    const dept =
      cleanPublicText(xmlTag(block, "jurOrgNm")) ||
      cleanPublicText(xmlTag(block, "bizChrDeptNm"));
    out.push({
      id,
      title,
      agency,
      department: dept,
      summary: clip(cleanPublicText(xmlTag(block, "servDgst"))),
      field: cleanPublicText(xmlTag(block, "intrsThemaArray") || xmlTag(block, "intrsThemaNmArray")),
      url: `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId=${encodeURIComponent(id)}`,
      source,
    });
  }
  return out;
}

function parseDetailXml(
  xml: string,
  source: PublicGrantRecord["source"],
  fallbackId?: string,
): PublicGrantRecord | undefined {
  const block =
    xml.match(/<wantedDtl>([\s\S]*?)<\/wantedDtl>/i)?.[1] ||
    xml.match(/<servDetail>([\s\S]*?)<\/servDetail>/i)?.[1] ||
    xml.match(/<item>([\s\S]*?)<\/item>/i)?.[1] ||
    xml;
  const id =
    xmlTag(block, "servId") ||
    xmlTag(block, "servID") ||
    fallbackId;
  const title = cleanPublicText(xmlTag(block, "servNm"));
  if (!id || !title) return undefined;
  return {
    id,
    title,
    agency: cleanPublicText(xmlTag(block, "jurMnofNm") || xmlTag(block, "ctpvNm")),
    department: cleanPublicText(xmlTag(block, "jurOrgNm") || xmlTag(block, "bizChrDeptNm")),
    summary: clip(
      cleanPublicText(xmlTag(block, "servDgst") || xmlTag(block, "alwServCn")),
    ),
    target: cleanPublicText(xmlTag(block, "tgtrDtlCn") || xmlTag(block, "slctCritCn")),
    criteria: cleanPublicText(xmlTag(block, "slctCritCn")),
    content: cleanPublicText(xmlTag(block, "alwServCn") || xmlTag(block, "sprtCyl")),
    howToApply: cleanPublicText(xmlTag(block, "aplyMtdCn") || xmlTag(block, "aplyMtdNm")),
    documents: cleanPublicText(xmlTag(block, "basFrmList") || xmlTag(block, "inqReqNmArr")),
    deadline: cleanPublicText(xmlTag(block, "aplyPrd") || xmlTag(block, "sprtTrgtPrd")),
    phone: cleanPublicText(xmlTag(block, "rprsCtadr")),
    field: cleanPublicText(xmlTag(block, "intrsThemaArray")),
    url: `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId=${encodeURIComponent(id)}`,
    source,
  };
}

export async function searchCentralWelfare(
  keyword: string,
  options: { pageNo?: number; numOfRows?: number } = {},
): Promise<PublicGrantRecord[]> {
  const q = keyword.trim();
  if (!q) return [];
  const xml = await fetchPublicText(CENTRAL_LIST, {
    callTp: "L",
    pageNo: options.pageNo ?? 1,
    numOfRows: options.numOfRows ?? 8,
    srchKeyCode: "001",
    searchWrd: q,
  });
  if (!xml || !xml.includes("SUCCESS")) return [];
  return parseListXml(xml, "welfare-central");
}

export async function fetchCentralWelfareDetail(
  serviceId: string,
): Promise<PublicGrantRecord | undefined> {
  const xml = await fetchPublicText(CENTRAL_DETAIL, {
    callTp: "D",
    servId: serviceId,
  });
  if (!xml) return undefined;
  return parseDetailXml(xml, "welfare-central", serviceId);
}

export async function searchLocalWelfare(
  keyword: string,
  options: { pageNo?: number; numOfRows?: number } = {},
): Promise<PublicGrantRecord[]> {
  const q = keyword.trim();
  if (!q) return [];
  const xml = await fetchPublicText(LOCAL_LIST, {
    pageNo: options.pageNo ?? 1,
    numOfRows: options.numOfRows ?? 8,
    searchWrd: q,
  });
  if (!xml || !/SUCCESS|resultCode>0</i.test(xml)) {
    // Some local endpoints ignore searchWrd — fall back to first page and filter client-side.
    const all = await fetchPublicText(LOCAL_LIST, {
      pageNo: 1,
      numOfRows: Math.max(20, options.numOfRows ?? 8),
    });
    if (!all) return [];
    const rows = parseListXml(all, "welfare-local");
    const needle = q.replace(/\s+/g, "");
    return rows.filter((row) => row.title.replace(/\s+/g, "").includes(needle)).slice(0, 8);
  }
  return parseListXml(xml, "welfare-local");
}

export async function fetchLocalWelfareDetail(
  serviceId: string,
): Promise<PublicGrantRecord | undefined> {
  const xml = await fetchPublicText(LOCAL_DETAIL, {
    servId: serviceId,
  });
  if (!xml) return undefined;
  return parseDetailXml(xml, "welfare-local", serviceId);
}

export async function matchWelfareService(
  keyword: string,
): Promise<PublicGrantRecord | undefined> {
  const [central, local] = await Promise.all([
    searchCentralWelfare(keyword, { numOfRows: 6 }),
    searchLocalWelfare(keyword, { numOfRows: 6 }),
  ]);
  const merged = [...central, ...local];
  if (!merged.length) return undefined;
  const normalized = keyword.replace(/\s+/g, "");
  merged.sort((a, b) => {
    const aHit = a.title.replace(/\s+/g, "").includes(normalized) ? 1 : 0;
    const bHit = b.title.replace(/\s+/g, "").includes(normalized) ? 1 : 0;
    return bHit - aHit;
  });
  const top = merged[0]!;
  if (top.source === "welfare-central") {
    return (await fetchCentralWelfareDetail(top.id)) ?? top;
  }
  return (await fetchLocalWelfareDetail(top.id)) ?? top;
}
