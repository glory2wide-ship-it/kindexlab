import { REGION_HOUSING_APARTMENTS } from "@/lib/boards/housing-apartments";
import type { RegionSegment } from "@/lib/boards/types";
import { REGION_LABEL, REGION_SEGMENTS } from "@/lib/boards/regions";
import {
  dealYmdMonthsBack,
  fetchAptRents,
  fetchAptTrades,
  summarizeRents,
  summarizeTrades,
} from "@/lib/public-data/rtms";
import { hasDataGoKrKey } from "@/lib/public-data/key";

/** Representative 법정동 시군구코드(5) per 시/도 — RTMS LAWD_CD. */
export const REGION_LAWD_CODES: Record<RegionSegment, readonly string[]> = {
  seoul: ["11680", "11650", "11710", "11440", "11110"], // 강남 서초 송파 마포 종로
  gyeonggi: ["41135", "41111", "41285", "41465", "41117"], // 성남분당 수원장안 고양일산동 용인수정 수원영통
  incheon: ["28185", "28200", "28237"], // 연수 남동 부평
  busan: ["26440", "26350", "26290"], // 강서 해운대 금정
  daegu: ["27260", "27140"], // 수성 동구
  gwangju: ["29200", "29140"], // 광산 서구
  daejeon: ["30200", "30170"], // 유성 서구
  ulsan: ["31140", "31710"], // 남구 울주
  sejong: ["36110"],
  gangwon: ["42110", "42150"], // 춘천 강릉
  chungbuk: ["43110", "43130"], // 청주 충주
  chungnam: ["44200", "44131"], // 아산 천안동남
  jeonbuk: ["52110", "52140"], // 전주 군산 (신코드 계열 — 실패 시 빈 결과)
  jeonnam: ["46110", "46130"], // 목포 여수
  gyeongbuk: ["47110", "47130"], // 포항 경주
  gyeongnam: ["48120", "48170"], // 창원 진주
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
  sampleApt?: string;
  dealMonth?: string;
};

/**
 * Pull recent 매매·전월세 for an apartment (or region hotspot) via MOLIT RTMS.
 */
export async function summarizeHousingPublicData(
  aptOrRegionName: string,
): Promise<HousingPublicSummary | undefined> {
  if (!hasDataGoKrKey()) return undefined;
  const name = aptOrRegionName.trim();
  if (!name) return undefined;

  let region = regionForApartment(name);
  if (!region) {
    // If the entity is a 시/도 label itself
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
  const months = [0, 1, 2].map((back) => dealYmdMonthsBack(back));

  for (const ymd of months) {
    for (const lawd of lawds.slice(0, 3)) {
      const [trades, rents] = await Promise.all([
        fetchAptTrades(lawd, ymd, { numOfRows: 120 }),
        fetchAptRents(lawd, ymd, { numOfRows: 120 }),
      ]);
      const tradeSummary = summarizeTrades(trades, name);
      const rentSummary = summarizeRents(rents, name);
      if (tradeSummary || rentSummary) {
        return {
          region,
          regionLabel: REGION_LABEL[region],
          tradeSummary,
          rentSummary,
          sampleApt: trades.find((t) => t.aptName.includes(name) || name.includes(t.aptName))
            ?.aptName,
          dealMonth: ymd,
        };
      }
      // No name match — if looking up a region board tile, summarize district volume.
      if (!regionForApartment(name) && trades.length) {
        return {
          region,
          regionLabel: REGION_LABEL[region],
          tradeSummary: summarizeTrades(trades),
          rentSummary: summarizeRents(rents),
          sampleApt: trades[0]?.aptName,
          dealMonth: ymd,
        };
      }
    }
  }
  return undefined;
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
