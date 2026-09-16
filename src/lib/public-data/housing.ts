import { REGION_HOUSING_APARTMENTS } from "@/lib/boards/housing-apartments";
import type { RegionSegment } from "@/lib/boards/types";
import { REGION_LABEL, REGION_SEGMENTS } from "@/lib/boards/regions";
import { fetchNaverWebFallback } from "@/lib/context/fallback-naver";
import {
  dealYmdMonthsBack,
  fetchAptRents,
  fetchAptTrades,
  filterAptDeals,
  formatManwon,
  monthlyTradeMids,
  summarizeRents,
  summarizeTrades,
  summarizeTradesByPyeong,
} from "@/lib/public-data/rtms";
import { hasDataGoKrKey } from "@/lib/public-data/key";
import type { AptRentDeal, AptTradeDeal } from "@/lib/public-data/types";

/** Representative 법정동 시군구코드(5) per 시/도 — RTMS LAWD_CD. */
export const REGION_LAWD_CODES: Record<RegionSegment, readonly string[]> = {
  seoul: ["11680", "11650", "11710", "11440", "11110"],
  gyeonggi: ["41135", "41111", "41285", "41465", "41117"],
  incheon: ["28185", "28200", "28237"],
  busan: ["26440", "26350", "26290"],
  daegu: ["27260", "27140"],
  gwangju: ["29200", "29140"],
  daejeon: ["30200", "30170"],
  ulsan: ["31140", "31710"],
  sejong: ["36110"],
  gangwon: ["42110", "42150"],
  chungbuk: ["43110", "43130"],
  chungnam: ["44200", "44131"],
  jeonbuk: ["52110", "52140"],
  jeonnam: ["46110", "46130"],
  gyeongbuk: ["47110", "47130"],
  gyeongnam: ["48120", "48170"],
  jeju: ["50110", "50130"],
};

export function regionForApartment(name: string): RegionSegment | undefined {
  const needle = name.trim();
  if (!needle) return undefined;
  for (const segment of REGION_SEGMENTS) {
    const list = REGION_HOUSING_APARTMENTS[segment] ?? [];
    if (list.some((apt) => apt === needle || apt.includes(needle) || needle.includes(apt))) {
      return segment;
    }
  }
  for (const [segment, label] of Object.entries(REGION_LABEL) as Array<[RegionSegment, string]>) {
    if (needle.startsWith(label)) return segment;
  }
  return undefined;
}

export type HousingPublicSummary = {
  region?: RegionSegment;
  regionLabel?: string;
  tradeSummary?: string;
  rentSummary?: string;
  /** 평수 밴드별 중위 매매가 (최근 2개월 묶음). */
  byPyeong?: string;
  /** 신규 분양가 — 공공 API에 없어 네이버 웹 스니펫/검색 링크로 보조. */
  saleOffer?: string;
  saleOfferUrl?: string;
  /** 월별 중위 매매가 (스파크라인용, 만원). */
  trendPoints?: Array<{ label: string; value: number }>;
  trendSummary?: string;
  landNaverUrl?: string;
  sampleApt?: string;
  dealMonth?: string;
};

function landNaverSearchUrl(name: string): string {
  return `https://new.land.naver.com/search?ms=37.5665,126.9780,12&a=APT:ABYG:JGC&e=RETAIL&article=false&keyword=${encodeURIComponent(name)}`;
}

async function naverSaleOfferFallback(
  name: string,
): Promise<{ text?: string; url?: string } | undefined> {
  try {
    const sources = await fetchNaverWebFallback(`${name} 분양가 신규분양`, 5, {
      preferOfficial: false,
    });
    for (const source of sources) {
      const blob = `${source.title} ${source.snippet ?? ""}`;
      const hit = blob.match(
        /((?:분양가|공급가|최고가|최저가)[^\n]{0,24}?(?:\d[\d,.]*)\s*(?:억|만원)[^\n]{0,20})/,
      );
      if (hit?.[1]) {
        return { text: hit[1].replace(/\s+/g, " ").trim().slice(0, 120), url: source.url };
      }
    }
    if (sources[0]) {
      return {
        text: `네이버·웹 검색 참고 · ${sources[0].title.slice(0, 40)}`,
        url: sources[0].url,
      };
    }
  } catch {
    /* soft-fail */
  }
  return undefined;
}

/**
 * Pull recent 매매·전월세 for an apartment (or region hotspot) via MOLIT RTMS,
 * with Naver web as 2차 보조 for 분양가 / deep-link.
 */
export async function summarizeHousingPublicData(
  aptOrRegionName: string,
): Promise<HousingPublicSummary | undefined> {
  const name = aptOrRegionName.trim();
  if (!name) return undefined;

  let region = regionForApartment(name);
  if (!region) {
    for (const [segment, label] of Object.entries(REGION_LABEL) as Array<
      [RegionSegment, string]
    >) {
      if (name === label || name.includes(label)) {
        region = segment;
        break;
      }
    }
  }
  region = region ?? "seoul";
  const lawds = REGION_LAWD_CODES[region] ?? REGION_LAWD_CODES.seoul;
  const monthsBack = [0, 1, 2, 3, 4, 5];
  const allTrades: AptTradeDeal[] = [];
  const allRents: AptRentDeal[] = [];

  if (hasDataGoKrKey()) {
    for (const back of monthsBack) {
      const ymd = dealYmdMonthsBack(back);
      for (const lawd of lawds.slice(0, 2)) {
        const [trades, rents] = await Promise.all([
          fetchAptTrades(lawd, ymd, { numOfRows: 100 }),
          back <= 2 ? fetchAptRents(lawd, ymd, { numOfRows: 80 }) : Promise.resolve([]),
        ]);
        allTrades.push(...trades);
        allRents.push(...rents);
      }
    }
  }

  const matchedTrades = filterAptDeals(allTrades, name);
  const matchedRents = filterAptDeals(allRents, name);
  const useTrades = matchedTrades.length ? matchedTrades : regionForApartment(name) ? [] : allTrades;
  const useRents = matchedRents.length ? matchedRents : regionForApartment(name) ? [] : allRents;

  const tradeSummary = summarizeTrades(useTrades.length ? useTrades : matchedTrades, name);
  const rentSummary = summarizeRents(useRents.length ? useRents : matchedRents, name);
  const byPyeong = summarizeTradesByPyeong(
    matchedTrades.length ? matchedTrades : useTrades,
    matchedTrades.length ? undefined : name,
  );
  const trendPoints = monthlyTradeMids(matchedTrades.length ? matchedTrades : useTrades);
  const trendSummary =
    trendPoints.length >= 2
      ? trendPoints
          .map((p) => `${p.label} ${formatManwon(p.value)}`)
          .join(" → ")
      : undefined;

  const sale = await naverSaleOfferFallback(name);
  const landUrl = landNaverSearchUrl(name);

  if (
    !tradeSummary &&
    !rentSummary &&
    !byPyeong &&
    !sale?.text &&
    trendPoints.length === 0
  ) {
    return {
      region,
      regionLabel: REGION_LABEL[region],
      landNaverUrl: landUrl,
      saleOffer: sale?.text,
      saleOfferUrl: sale?.url || landUrl,
    };
  }

  return {
    region,
    regionLabel: REGION_LABEL[region],
    tradeSummary: tradeSummary || summarizeTrades(matchedTrades),
    rentSummary: rentSummary || summarizeRents(matchedRents),
    byPyeong,
    saleOffer: sale?.text,
    saleOfferUrl: sale?.url || landUrl,
    trendPoints: trendPoints.length ? trendPoints : undefined,
    trendSummary,
    landNaverUrl: landUrl,
    sampleApt: (matchedTrades[0] || useTrades[0])?.aptName,
    dealMonth: dealYmdMonthsBack(0),
  };
}

/** Top traded apt names in a region for LIVE heatmap seeds. */
export async function topTradedApartments(
  region: RegionSegment,
  options: { limit?: number } = {},
): Promise<Array<{ name: string; deals: number; midManwon: number }>> {
  if (!hasDataGoKrKey()) return [];
  const limit = options.limit ?? 20;
  const lawds = REGION_LAWD_CODES[region] ?? [];
  const ymd = dealYmdMonthsBack(1);
  const counts = new Map<string, { deals: number; amounts: number[] }>();
  for (const lawd of lawds.slice(0, 2)) {
    const trades = await fetchAptTrades(lawd, ymd, { numOfRows: 100 });
    for (const trade of trades) {
      const key = trade.aptName;
      const cur = counts.get(key) ?? { deals: 0, amounts: [] };
      cur.deals += 1;
      cur.amounts.push(trade.amountManwon);
      counts.set(key, cur);
    }
  }
  return [...counts.entries()]
    .map(([name, stat]) => {
      const sorted = [...stat.amounts].sort((a, b) => a - b);
      const mid = sorted[Math.floor(sorted.length / 2)] ?? 0;
      return { name, deals: stat.deals, midManwon: mid };
    })
    .sort((a, b) => b.deals - a.deals || b.midManwon - a.midManwon)
    .slice(0, limit);
}
