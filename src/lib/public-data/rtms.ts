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

export function filterAptDeals<T extends { aptName: string }>(
  deals: T[],
  aptHint?: string,
): T[] {
  if (!aptHint) return deals;
  const hint = aptHint.replace(/\s+/g, "");
  if (!hint) return deals;
  return deals.filter((d) => {
    const apt = d.aptName.replace(/\s+/g, "");
    if (!apt) return false;
    if (apt === hint || apt.includes(hint)) return true;
    return apt.length >= 4 && hint.includes(apt);
  });
}

export function formatManwon(amount: number): string {
  if (amount >= 10_000) {
    const eok = Math.floor(amount / 10_000);
    const rest = amount % 10_000;
    return rest ? `${eok}억 ${rest.toLocaleString("ko-KR")}만원` : `${eok}억`;
  }
  return `${amount.toLocaleString("ko-KR")}만원`;
}

/** 전용㎡ → 대략 평 (1평 ≈ 3.3058㎡). */
export function areaToPyeong(areaM2: number): number {
  return areaM2 / 3.3058;
}

export function pyeongBandLabel(pyeong: number): string {
  const band = Math.floor(pyeong / 10) * 10;
  if (band < 10) return "10평 미만";
  return `${band}평대`;
}

/** Mid trade price per pyeong band for the last ~2 months of deals. */
export function summarizeTradesByPyeong(
  deals: AptTradeDeal[],
  aptHint?: string,
): string | undefined {
  const filtered = filterAptDeals(deals, aptHint).filter((d) => d.areaM2 && d.areaM2 > 0);
  if (!filtered.length) return undefined;
  const bands = new Map<string, number[]>();
  for (const deal of filtered) {
    const band = pyeongBandLabel(areaToPyeong(deal.areaM2!));
    const list = bands.get(band) ?? [];
    list.push(deal.amountManwon);
    bands.set(band, list);
  }
  const parts = [...bands.entries()]
    .map(([band, amounts]) => {
      const sorted = [...amounts].sort((a, b) => a - b);
      const mid = sorted[Math.floor(sorted.length / 2)]!;
      return { band, mid, n: amounts.length, order: Number(band.replace(/\D/g, "")) || 0 };
    })
    .sort((a, b) => a.order - b.order)
    .slice(0, 5)
    .map((row) => `${row.band} 중위 ${formatManwon(row.mid)}(${row.n}건)`);
  return parts.length ? parts.join(" · ") : undefined;
}

export function monthlyTradeMids(
  deals: AptTradeDeal[],
  aptHint?: string,
): Array<{ label: string; value: number }> {
  const filtered = filterAptDeals(deals, aptHint);
  const byMonth = new Map<string, number[]>();
  for (const deal of filtered) {
    const label = `${deal.dealYear}.${String(deal.dealMonth).padStart(2, "0")}`;
    const list = byMonth.get(label) ?? [];
    list.push(deal.amountManwon);
    byMonth.set(label, list);
  }
  return [...byMonth.entries()]
    .map(([label, amounts]) => {
      const sorted = [...amounts].sort((a, b) => a - b);
      return { label, value: sorted[Math.floor(sorted.length / 2)]! };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** 전세(월세 0) 중위 보증금 시계열. */
export function monthlyJeonseMids(
  deals: AptRentDeal[],
  aptHint?: string,
): Array<{ label: string; value: number }> {
  const filtered = filterAptDeals(deals, aptHint).filter((d) => d.monthlyRentManwon === 0);
  const byMonth = new Map<string, number[]>();
  for (const deal of filtered) {
    const label = `${deal.dealYear}.${String(deal.dealMonth).padStart(2, "0")}`;
    const list = byMonth.get(label) ?? [];
    list.push(deal.depositManwon);
    byMonth.set(label, list);
  }
  return [...byMonth.entries()]
    .map(([label, amounts]) => {
      const sorted = [...amounts].sort((a, b) => a - b);
      return { label, value: sorted[Math.floor(sorted.length / 2)]! };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** 월세 중위 월임대료 시계열 (보증금은 제외). */
export function monthlyRentMids(
  deals: AptRentDeal[],
  aptHint?: string,
): Array<{ label: string; value: number }> {
  const filtered = filterAptDeals(deals, aptHint).filter((d) => d.monthlyRentManwon > 0);
  const byMonth = new Map<string, number[]>();
  for (const deal of filtered) {
    const label = `${deal.dealYear}.${String(deal.dealMonth).padStart(2, "0")}`;
    const list = byMonth.get(label) ?? [];
    list.push(deal.monthlyRentManwon);
    byMonth.set(label, list);
  }
  return [...byMonth.entries()]
    .map(([label, amounts]) => {
      const sorted = [...amounts].sort((a, b) => a - b);
      return { label, value: sorted[Math.floor(sorted.length / 2)]! };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function summarizeTrades(deals: AptTradeDeal[], aptHint?: string): string | undefined {
  const filtered = filterAptDeals(deals, aptHint);
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
  const filtered = filterAptDeals(deals, aptHint);
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
