import {
  cleanPublicText,
  fetchPublicText,
  xmlItems,
  xmlTag,
} from "@/lib/public-data/http";
import type { AptRentDeal, AptTradeDeal } from "@/lib/public-data/types";

const TRADE =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
const RENT =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";

function parseManwon(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

function parseTradeItem(block: string): AptTradeDeal | undefined {
  const aptName = cleanPublicText(xmlTag(block, "aptNm"));
  const amount = parseManwon(xmlTag(block, "dealAmount"));
  const dealYear = Number(xmlTag(block, "dealYear"));
  const dealMonth = Number(xmlTag(block, "dealMonth"));
  if (!aptName || amount == null || !dealYear || !dealMonth) return undefined;
  return {
    aptName,
    amountManwon: amount,
    areaM2: Number(xmlTag(block, "excluUseAr")) || undefined,
    floor: xmlTag(block, "floor")?.trim(),
    dealYear,
    dealMonth,
    dealDay: Number(xmlTag(block, "dealDay")) || undefined,
    dong: cleanPublicText(xmlTag(block, "umdNm") || xmlTag(block, "aptDong")),
    buildYear: Number(xmlTag(block, "buildYear")) || undefined,
  };
}

function parseRentItem(block: string): AptRentDeal | undefined {
  const aptName = cleanPublicText(xmlTag(block, "aptNm"));
  const deposit = parseManwon(xmlTag(block, "deposit"));
  const monthly = parseManwon(xmlTag(block, "monthlyRent")) ?? 0;
  const dealYear = Number(xmlTag(block, "dealYear"));
  const dealMonth = Number(xmlTag(block, "dealMonth"));
  if (!aptName || deposit == null || !dealYear || !dealMonth) return undefined;
  return {
    aptName,
    depositManwon: deposit,
    monthlyRentManwon: monthly,
    areaM2: Number(xmlTag(block, "excluUseAr")) || undefined,
    floor: xmlTag(block, "floor")?.trim(),
    dealYear,
    dealMonth,
    dealDay: Number(xmlTag(block, "dealDay")) || undefined,
    dong: cleanPublicText(xmlTag(block, "umdNm")),
  };
}

export function dealYmdMonthsBack(monthsBack = 0): string {
  const now = new Date();
  // Approximate KST by using UTC+9 offset for calendar month.
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCMonth(kst.getUTCMonth() - monthsBack);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

export async function fetchAptTrades(
  lawdCd: string,
  dealYmd: string,
  options: { pageNo?: number; numOfRows?: number } = {},
): Promise<AptTradeDeal[]> {
  const xml = await fetchPublicText(TRADE, {
    LAWD_CD: lawdCd,
    DEAL_YMD: dealYmd,
    pageNo: options.pageNo ?? 1,
    numOfRows: options.numOfRows ?? 100,
  });
  if (!xml || !xml.includes("<resultCode>000</resultCode>")) return [];
  return xmlItems(xml)
    .map(parseTradeItem)
    .filter((row): row is AptTradeDeal => Boolean(row));
}

export async function fetchAptRents(
  lawdCd: string,
  dealYmd: string,
  options: { pageNo?: number; numOfRows?: number } = {},
): Promise<AptRentDeal[]> {
  const xml = await fetchPublicText(RENT, {
    LAWD_CD: lawdCd,
    DEAL_YMD: dealYmd,
    pageNo: options.pageNo ?? 1,
    numOfRows: options.numOfRows ?? 100,
  });
  if (!xml || !xml.includes("<resultCode>000</resultCode>")) return [];
  return xmlItems(xml)
    .map(parseRentItem)
    .filter((row): row is AptRentDeal => Boolean(row));
}

export function formatManwon(amount: number): string {
  if (amount >= 10_000) {
    const eok = Math.floor(amount / 10_000);
    const rest = amount % 10_000;
    return rest ? `${eok}억 ${rest.toLocaleString("ko-KR")}만원` : `${eok}억`;
  }
  return `${amount.toLocaleString("ko-KR")}만원`;
}

export function summarizeTrades(deals: AptTradeDeal[], aptHint?: string): string | undefined {
  const filtered = aptHint
    ? deals.filter((d) => {
        const apt = d.aptName.replace(/\s+/g, "");
        const hint = aptHint.replace(/\s+/g, "");
        if (!apt || !hint) return false;
        if (apt === hint || apt.includes(hint)) return true;
        // Avoid short-token false positives (e.g. "대치" inside a long complex name).
        return apt.length >= 4 && hint.includes(apt);
      })
    : deals;
  if (!filtered.length) return undefined;
  const amounts = filtered.map((d) => d.amountManwon).sort((a, b) => a - b);
  const mid = amounts[Math.floor(amounts.length / 2)]!;
  const min = amounts[0]!;
  const max = amounts[amounts.length - 1]!;
  const sample = filtered[0]!;
  const area =
    sample.areaM2 != null
      ? ` · 전용 ${sample.areaM2.toFixed(1)}㎡급`
      : "";
  return `${sample.dealYear}.${sample.dealMonth} 매매 ${filtered.length}건 · 중위 ${formatManwon(mid)} (최저 ${formatManwon(min)}~최고 ${formatManwon(max)})${area}`;
}

export function summarizeRents(deals: AptRentDeal[], aptHint?: string): string | undefined {
  const filtered = aptHint
    ? deals.filter((d) => {
        const apt = d.aptName.replace(/\s+/g, "");
        const hint = aptHint.replace(/\s+/g, "");
        if (!apt || !hint) return false;
        if (apt === hint || apt.includes(hint)) return true;
        // Avoid short-token false positives (e.g. "대치" inside a long complex name).
        return apt.length >= 4 && hint.includes(apt);
      })
    : deals;
  if (!filtered.length) return undefined;
  const jeonse = filtered.filter((d) => d.monthlyRentManwon === 0);
  const monthly = filtered.filter((d) => d.monthlyRentManwon > 0);
  const parts: string[] = [];
  if (jeonse.length) {
    const deposits = jeonse.map((d) => d.depositManwon).sort((a, b) => a - b);
    const mid = deposits[Math.floor(deposits.length / 2)]!;
    parts.push(`전세 ${jeonse.length}건 중위보증 ${formatManwon(mid)}`);
  }
  if (monthly.length) {
    const sample = monthly[0]!;
    parts.push(
      `월세 예 ${formatManwon(sample.depositManwon)}/${sample.monthlyRentManwon}만원`,
    );
  }
  return parts.length ? `${filtered[0]!.dealYear}.${filtered[0]!.dealMonth} ${parts.join(" · ")}` : undefined;
}
