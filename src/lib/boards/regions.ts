import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import { formatBracketLabel, parseBracketLabel } from "@/lib/politics/labeled-rank";
import type { BoardRankEntry, RegionSegment } from "@/lib/boards/types";

export const FOOD_RESTAURANT_SLUG = "food-restaurant-ranking";

export const REGION_SEGMENTS: RegionSegment[] = [
  "seoul",
  "gyeonggi",
  "incheon",
  "busan",
  "daegu",
  "gwangju",
  "daejeon",
  "ulsan",
  "sejong",
  "gangwon",
  "chungbuk",
  "chungnam",
  "jeonbuk",
  "jeonnam",
  "gyeongbuk",
  "gyeongnam",
  "jeju",
];

export const REGION_LABEL: Record<RegionSegment, string> = {
  seoul: "서울",
  gyeonggi: "경기",
  incheon: "인천",
  busan: "부산",
  daegu: "대구",
  gwangju: "광주",
  daejeon: "대전",
  ulsan: "울산",
  sejong: "세종",
  gangwon: "강원",
  chungbuk: "충북",
  chungnam: "충남",
  jeonbuk: "전북",
  jeonnam: "전남",
  gyeongbuk: "경북",
  gyeongnam: "경남",
  jeju: "제주",
};

const REGION_ALIASES: Record<string, RegionSegment> = {
  서울: "seoul",
  서울시: "seoul",
  서울특별시: "seoul",
  경기: "gyeonggi",
  경기도: "gyeonggi",
  인천: "incheon",
  인천시: "incheon",
  인천광역시: "incheon",
  부산: "busan",
  부산시: "busan",
  부산광역시: "busan",
  대구: "daegu",
  대구시: "daegu",
  대구광역시: "daegu",
  광주: "gwangju",
  광주시: "gwangju",
  광주광역시: "gwangju",
  대전: "daejeon",
  대전시: "daejeon",
  대전광역시: "daejeon",
  울산: "ulsan",
  울산시: "ulsan",
  울산광역시: "ulsan",
  세종: "sejong",
  세종시: "sejong",
  세종특별자치시: "sejong",
  강원: "gangwon",
  강원도: "gangwon",
  강원특별자치도: "gangwon",
  충북: "chungbuk",
  충청북도: "chungbuk",
  충남: "chungnam",
  충청남도: "chungnam",
  전북: "jeonbuk",
  전라북도: "jeonbuk",
  전북특별자치도: "jeonbuk",
  전남: "jeonnam",
  전라남도: "jeonnam",
  경북: "gyeongbuk",
  경상북도: "gyeongbuk",
  경남: "gyeongnam",
  경상남도: "gyeongnam",
  제주: "jeju",
  제주도: "jeju",
  제주특별자치도: "jeju",
  경상북: "gyeongbuk",
  경상남: "gyeongnam",
  충청북: "chungbuk",
  충청남: "chungnam",
  전라북: "jeonbuk",
  전라남: "jeonnam",
  seoul: "seoul",
  gyeonggi: "gyeonggi",
  incheon: "incheon",
  busan: "busan",
  daegu: "daegu",
  gwangju: "gwangju",
  daejeon: "daejeon",
  ulsan: "ulsan",
  sejong: "sejong",
  gangwon: "gangwon",
  chungbuk: "chungbuk",
  chungnam: "chungnam",
  jeonbuk: "jeonbuk",
  jeonnam: "jeonnam",
  gyeongbuk: "gyeongbuk",
  gyeongnam: "gyeongnam",
  jeju: "jeju",
};

/** Local-only dishes used to pad a region tab. Never cross 시/도. */
export const REGION_FOOD_CATALOG: Record<RegionSegment, readonly string[]> = {
  seoul: [
    "광장시장 마약김밥",
    "광화문 한정식",
    "이태원 경양식",
    "성수 수제버거",
    "을지로 노가리",
    "광장시장 빈대떡",
    "마포 돼지갈비",
    "종로 설렁탕",
    "홍대 떡볶이",
    "강남 한우",
    "연남 카페거리",
    "잠실 곱창",
    "혜화 파스타",
    "명동 칼국수",
    "한남 브런치",
  ],
  gyeonggi: [
    "수원 갈비",
    "이천 쌀밥",
    "포천 이동갈비",
    "양평 한우",
    "가평 막국수",
    "용인 순대",
    "파주 장단콩",
    "여주 쌀밥정식",
    "의정부 부대찌개",
    "분당 고깃집",
    "남양주 막걸리",
    "화성 곱창",
  ],
  incheon: [
    "차이나타운 짜장면",
    "신포 닭강정",
    "소래포구 칼국수",
    "월미도 회",
    "강화 밴댕이",
    "송도 브런치",
    "동인천 순대",
    "영종 해물라면",
    "부평 막창",
    "계양 국밥",
  ],
  busan: [
    "서면 밀면",
    "광안리 회",
    "자갈치 곰장어",
    "남포동 씨앗호떡",
    "해운대 돼지국밥",
    "기장 대게",
    "동래 파전",
    "영도 카페",
    "전포 커피",
    "민락 회센터",
    "감천 골목밥",
    "사상 곱창",
  ],
  daegu: [
    "막창",
    "따로국밥",
    "납작만두",
    "동인동찜갈비",
    "안지랑 곱창",
    "서문시장 칼국수",
    "수성못 카페",
    "동성로 떡볶이",
    "팔공산 막걸리",
    "침산 닭똥집",
  ],
  gwangju: [
    "송정떡갈비",
    "오리탕",
    "한정식",
    "무등산 보리밥",
    "충장로 육전",
    "양동시장 국밥",
    "풍암 돼지불백",
    "첨단 카페",
    "하남 오리",
    "동명동 파스타",
  ],
  daejeon: [
    "성심당 튀김소보로",
    "칼국수",
    "꾸아과",
    "은행동 빵",
    "유성 오리로스",
    "둔산 곱창",
    "중앙시장 순대",
    "대청호 민물회",
    "궁동 국밥",
    "도안 브런치",
  ],
  ulsan: [
    "언양불고기",
    "고래고기",
    "울산 언양미나리",
    "태화강 카페",
    "장생포 회",
    "남구 곱창",
    "동구 고등어",
    "울주 한우",
    "성남동 국밥",
    "남구 떡볶이",
  ],
  sejong: [
    "세종 카페거리",
    "조치원 국밥",
    "세종호수공원 브런치",
    "나성동 고깃집",
    "어진동 한식",
    "소정 순대",
    "금남 딸기",
    "도담 파스타",
    "새롬 분식",
    "한솔 카페",
  ],
  gangwon: [
    "춘천 닭갈비",
    "속초 오징어순대",
    "강릉 초당순두부",
    "정선 곤드레밥",
    "양양 서피비치 카페",
    "동해 찜",
    "평창 한우",
    "원주 추어탕",
    "홍천 막국수",
    "삼척 생선구이",
    "인제 황태",
    "철원 오대쌀밥",
  ],
  chungbuk: [
    "청주 올갱이국",
    "충주 사과막걸리",
    "제천 약채한정식",
    "단양 마늘족발",
    "음성 한우",
    "괴산 대학찰옥수수",
    "진천 쌀밥",
    "증평 인삼닭",
    "보은 대추한과",
    "영동 포도",
  ],
  chungnam: [
    "예산 국밥",
    "천안 호두과자",
    "서산 어리굴젓",
    "보령 머드칼국수",
    "공주 밤한정식",
    "아산 온양갈비",
    "논산 강경젓갈",
    "당진 대게",
    "태안 꽃게",
    "부여 연밥",
  ],
  jeonbuk: [
    "전주 비빔밥",
    "전주 한옥마을 막걸리",
    "군산 짬뽕",
    "익산 보석리조트 한우",
    "정읍 한우",
    "남원 추어탕",
    "김제 지평선밥",
    "완주 로컬푸드",
    "고창 풍천장어",
    "부안 바지락",
  ],
  jeonnam: [
    "여수 갓김치",
    "여수 게장",
    "순천만 꼬막",
    "목포 홍어",
    "해남 고구마",
    "담양 떡갈비",
    "보성 녹차냉면",
    "광양 불고기",
    "나주 곰탕",
    "완도 전복",
    "진도 울금밥",
    "강진 한정식",
  ],
  gyeongbuk: [
    "안동 찜닭",
    "안동 간고등어",
    "포항 과메기",
    "경주 황남빵",
    "구미 낙동강국밥",
    "김천 한우",
    "영주 풍기인삼닭",
    "문경 오미자",
    "울진 대게",
    "영덕 대게",
    "청도 감와인안주",
    "상주 곶감",
  ],
  gyeongnam: [
    "진주 냉면",
    "진주 비빔밥",
    "통영 꿀빵",
    "통영 시락국",
    "거제 대구탕",
    "창원 아구찜",
    "김해 불고기",
    "양산 물곰탕",
    "사천 멸치쌈밥",
    "남해 갈치조림",
    "하동 녹차칼국수",
    "밀양 대추한정식",
  ],
  jeju: [
    "흑돼지",
    "고기국수",
    "갈치조림",
    "옥돔구이",
    "성게미역국",
    "고등어회",
    "몸국",
    "전복죽",
    "빙떡",
    "오메기떡",
    "한라봉주스",
    "성산 해녀의집",
    "애월 카페거리",
    "서귀포 갈치조림",
    "중문 흑돼지",
  ],
};

const ALIAS_KEYS = Object.keys(REGION_ALIASES)
  .filter((key) => /[가-힣]/.test(key))
  .sort((a, b) => b.length - a.length);

export function isRegionSegment(key: string): key is RegionSegment {
  return (REGION_SEGMENTS as string[]).includes(key);
}

export function boardUsesRegionFilter(slug?: string): boolean {
  return slug === FOOD_RESTAURANT_SLUG;
}

function aliasToRegion(token: string): RegionSegment | undefined {
  const trimmed = token.trim();
  if (!trimmed) return undefined;
  return REGION_ALIASES[trimmed] ?? REGION_ALIASES[trimmed.replace(/\s+/g, "")];
}

/** Tab label (`경남`), official name (`경상남도`), or slug (`gyeongnam`) → segment. */
export function normalizeRegionInput(raw?: string | null): RegionSegment | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "all") return undefined;
  if (isRegionSegment(trimmed)) return trimmed;
  return aliasToRegion(trimmed);
}

export function parseRegionQuery(raw: string | null | undefined): "all" | RegionSegment {
  return normalizeRegionInput(raw) ?? "all";
}

export function rowBelongsToRegion(
  row: Pick<BoardRankEntry, "name" | "region">,
  region: RegionSegment,
): boolean {
  const tagged = row.region && isRegionSegment(row.region) ? row.region : undefined;
  if (tagged) return tagged === region;
  return regionFromName(row.name ?? "") === region;
}

export function filterRowsByRegion<T extends Pick<BoardRankEntry, "name" | "region">>(
  rows: T[] | undefined,
  region: RegionSegment,
): T[] {
  return (rows ?? []).filter((row) => rowBelongsToRegion(row, region));
}

export function entityMatchesRegion(
  item: { name?: string; region?: string; tags?: string[] },
  region: RegionSegment,
): boolean {
  if (item.region && isRegionSegment(item.region)) return item.region === region;
  const fromName = regionFromName(item.name ?? "");
  if (fromName) return fromName === region;
  const label = REGION_LABEL[region];
  return (item.tags ?? []).some((tag) => normalizeRegionInput(tag) === region || tag === label);
}

function catalogRowsForRegion(region: RegionSegment): BoardRankEntry[] {
  return REGION_FOOD_CATALOG[region].map((subject, index) => ({
    rank: index + 1,
    name: formatBracketLabel(REGION_LABEL[region], subject),
    score: Number((86 - index * 1.15).toFixed(2)),
    changeRate: Number((((index % 5) - 2) * 1.05).toFixed(2)),
    note: `${REGION_LABEL[region]} 지역 맛집 카탈로그`,
    region,
  }));
}

/** Pad with the same 시/도 only. Never pull Seoul into a 제주 tab. */
export function padRegionOnly(
  rows: BoardRankEntry[],
  region: RegionSegment,
  limit: number,
): BoardRankEntry[] {
  const local = filterRowsByRegion(rows, region).map((row) => tagRegionOnRow({ ...row, region }));
  return padRankEntries(local, catalogRowsForRegion(region), limit);
}

export function regionFromName(name: string): RegionSegment | undefined {
  const labeled = parseBracketLabel(name);
  if (labeled?.org) {
    const fromOrg = aliasToRegion(labeled.org);
    if (fromOrg) return fromOrg;
  }
  const compact = name.replace(/\s+/g, "");
  for (const alias of ALIAS_KEYS) {
    if (compact.includes(alias.replace(/\s+/g, ""))) return REGION_ALIASES[alias];
  }
  return undefined;
}

export function tagRegionOnRow(row: BoardRankEntry, seeds: readonly string[] = []): BoardRankEntry {
  const fromName = regionFromName(row.name);
  const seedHit = seeds.find((seed) => namesOverlap(seed, row.name));
  const fromSeed = seedHit ? regionFromName(seedHit) : undefined;
  const region = fromName ?? fromSeed ?? row.region;
  if (!region) return row;
  const labeled = parseBracketLabel(row.name);
  const subject = labeled?.subject ?? (seedHit ? parseBracketLabel(seedHit)?.subject : undefined) ?? row.name;
  return {
    ...row,
    region,
    name: formatBracketLabel(REGION_LABEL[region], subject),
  };
}

export function ensureFoodRestaurantRanking(
  rows: BoardRankEntry[],
  seeds: readonly string[] = [],
): BoardRankEntry[] {
  const tagged = rows.map((row) => tagRegionOnRow(row, seeds));
  const unique: BoardRankEntry[] = [];
  const seen = new Set<string>();
  for (const row of tagged) {
    const key = normalizeName(row.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  for (const seed of seeds) {
    const key = normalizeName(seed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(
      tagRegionOnRow({
        rank: unique.length + 1,
        name: seed,
        score: Number((88 - unique.length * 1.15).toFixed(2)),
        changeRate: Number((((unique.length % 5) - 2) * 1.1).toFixed(2)),
        note: "지역 맛집 씨드 보완",
      }),
    );
  }
  return unique.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function padRankEntries(
  preferred: BoardRankEntry[],
  fallback: BoardRankEntry[],
  limit: number,
): BoardRankEntry[] {
  const cap = Math.max(1, limit);
  const seen = new Set<string>();
  const out: BoardRankEntry[] = [];
  const push = (row: BoardRankEntry) => {
    if (!row?.name || seen.has(row.name) || out.length >= cap) return;
    seen.add(row.name);
    out.push(row);
  };
  for (const row of preferred) push(row);
  for (const row of fallback) push(row);
  return out.map((row, index) => ({
    ...row,
    rank: index + 1,
    score: Number((Math.max(Number.isFinite(row.score) ? row.score : 12, 1) * (1 - index * 0.01)).toFixed(2)),
  }));
}

/** Reorder a region list by gender/age. Never introduces another 시/도. */
export function reweightRegionByDemographic(
  regionRows: BoardRankEntry[],
  demographicRows: BoardRankEntry[],
  fallback: BoardRankEntry[],
  limit: number,
  region?: RegionSegment,
): BoardRankEntry[] {
  const demoIndex = new Map(demographicRows.map((row, index) => [normalizeName(row.name), index]));
  const orderGroup = (rows: BoardRankEntry[]) =>
    [...rows]
      .map((row, index) => {
        const pos = demoIndex.get(normalizeName(row.name));
        const weight = pos == null ? 0.86 : Math.max(0.62, 1.12 - Math.min(pos, 24) * 0.012);
        return {
          row: {
            ...row,
            score: Number((Math.max(Number.isFinite(row.score) ? row.score : 12, 1) * weight).toFixed(2)),
          },
          pos: pos ?? 400 + index,
        };
      })
      .sort((left, right) => right.row.score - left.row.score || left.pos - right.pos)
      .map((item) => item.row);

  if (!region) {
    return padRankEntries(orderGroup(regionRows), fallback, limit);
  }
  const preferred = filterRowsByRegion(regionRows, region);
  const localFallback = filterRowsByRegion(fallback, region);
  return padRegionOnly(orderGroup(preferred.length ? preferred : localFallback), region, limit);
}

/** One slice per 시/도. Only that region's names — no adjacent/national fill. */
export function deriveRegionRankings(
  total: BoardRankEntry[],
  limit: number,
): Record<RegionSegment, BoardRankEntry[]> {
  const tagged = total.map((row) => tagRegionOnRow(row));
  const cap = Math.max(1, limit);
  return REGION_SEGMENTS.reduce(
    (acc, region) => {
      acc[region] = padRegionOnly(filterRowsByRegion(tagged, region), region, cap);
      return acc;
    },
    {} as Record<RegionSegment, BoardRankEntry[]>,
  );
}
