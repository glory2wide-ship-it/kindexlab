import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import type { BoardRankEntry } from "@/lib/boards/types";
import { matchPoliticsYoutubeSeed } from "@/lib/politics/youtube-seeds";

export interface BracketLabel {
  org: string;
  subject: string;
}

export interface PersonTagLabel {
  person: string;
  tag: string;
}

/** `[서울특별시] 기후동행카드` — locality + headline policy. */
export const LOCAL_POLICY_SEEDS = [
  "[서울특별시] 기후동행카드",
  "[서울특별시] 청년월세 특별지원",
  "[경기도] 청년기본소득",
  "[경기도] 경기패스",
  "[경기도 수원시] 새빛돌봄",
  "[전라남도] 100원 택시",
  "[부산광역시] 동백전",
  "[인천광역시] 인천e음",
  "[대구광역시] 대구행복페이",
  "[광주광역시] 광주상생카드",
  "[대전광역시] 대전사랑카드",
  "[제주특별자치도] 관광정책",
  "[세종특별자치시] 여민전",
  "[강원특별자치도] 강원상품권",
  "[충청남도] 청년농 지원",
] as const;

/** `[금융위원회] 청년도약계좌` — agency + program. */
export const SUBSIDY_SEEDS = [
  "[금융위원회] 청년도약계좌",
  "[중소벤처기업부] 소상공인 전기요금 지원",
  "[보건복지부] 부모급여",
  "[보건복지부] 기초연금",
  "[국세청] 근로장려금",
  "[국세청] 자녀장려금",
  "[고용노동부] 국민취업지원제도",
  "[국토교통부] 디딤돌대출",
  "[산업통상자원부] 에너지바우처",
  "[보건복지부] 청년내일저축계좌",
  "[주택도시보증공사] 전세보증금 반환보증",
  "[교육부] 국가장학금",
  "[여성가족부] 아이돌봄서비스",
  "[기획재정부] 민생회복 지원금",
  "[농림축산식품부] 청년농업인 영농정착지원",
  "[중소벤처기업부] 소상공인 대환대출",
  "[금융위원회] 안심전환대출",
  "[국토교통부] 버팀목전세자금",
  "[중소벤처기업부] 소상공인 정책자금",
  "[고용노동부] 내일배움카드",
  "[보건복지부] 긴급복지지원",
  "[중소벤처기업부] 온누리상품권",
  "[과학기술정보통신부] 디지털배움터",
  "[행정안전부] 지역사랑상품권",
  "[중소벤처기업부] 스마트상점 기술보급",
] as const;

/** `유시민 (알릴레오)` — pundit + outlet/role. */
export const PUNDIT_SEEDS = [
  "유시민 (알릴레오)",
  "진중권 (시사평론가)",
  "전원책 (시사평론가)",
  "김종배 (시사자키)",
  "김근식 (시사평론가)",
  "황희두 (시사평론가)",
  "이종훈 (시사평론가)",
  "최진봉 (시사평론가)",
  "장성철 (시사평론가)",
  "배종찬 (여론조사)",
  "박성민 (정치컨설턴트)",
  "조기숙 (시사평론가)",
  "금태섭 (시사평론가)",
  "김경율 (경제정의)",
  "서정욱 (시사평론가)",
] as const;

const MAYOR_ALIASES: { aliases: string[]; label: string }[] = [
  { aliases: ["서울시장", "오세훈", "서울특별시장"], label: "[서울특별시] 기후동행카드" },
  { aliases: ["경기도지사", "김동연"], label: "[경기도] 청년기본소득" },
  { aliases: ["부산시장", "박형준"], label: "[부산광역시] 동백전" },
  { aliases: ["인천시장", "유정복"], label: "[인천광역시] 인천e음" },
  { aliases: ["대구시장", "홍준표"], label: "[대구광역시] 대구행복페이" },
  { aliases: ["광주시장", "강기정"], label: "[광주광역시] 광주상생카드" },
  { aliases: ["대전시장", "이장우"], label: "[대전광역시] 대전사랑카드" },
  { aliases: ["제주도지사", "오영훈"], label: "[제주특별자치도] 관광정책" },
  { aliases: ["충남도지사", "김태흠", "충청남도지사"], label: "[충청남도] 청년농 지원" },
  { aliases: ["경기지사"], label: "[경기도] 청년기본소득" },
];

export function parseBracketLabel(name: string): BracketLabel | null {
  const match = name.trim().match(/^\[([^\]]{1,48})\]\s*(.+)$/);
  const org = match?.[1]?.trim();
  const subject = match?.[2]?.trim();
  if (!org || !subject) return null;
  return { org, subject };
}

export function parsePersonTag(name: string): PersonTagLabel | null {
  const match = name.trim().match(/^(.{2,24}?)\s*\(([^)]{2,24})\)\s*$/);
  const person = match?.[1]?.trim();
  const tag = match?.[2]?.trim();
  if (!person || !tag) return null;
  return { person, tag };
}

export function formatBracketLabel(org: string, subject: string): string {
  return `[${org.trim()}] ${subject.trim()}`;
}

function subjectKey(name: string): string {
  const bracket = parseBracketLabel(name);
  const person = parsePersonTag(name);
  return normalizeName(bracket?.subject ?? person?.person ?? name);
}

function findSeed(name: string, seeds: readonly string[]): string | undefined {
  const key = subjectKey(name);
  return seeds.find((seed) => {
    if (namesOverlap(seed, name)) return true;
    return subjectKey(seed) === key && key.length >= 2;
  });
}

function remapLocalPolicyName(name: string): string {
  const labeled = parseBracketLabel(name);
  if (labeled) return formatBracketLabel(labeled.org, labeled.subject);
  const hit = MAYOR_ALIASES.find((row) => row.aliases.some((alias) => namesOverlap(name, alias)));
  if (hit) return hit.label;
  const compact = normalizeName(name);
  const exactOrg = LOCAL_POLICY_SEEDS.find((seed) => {
    const org = parseBracketLabel(seed)?.org;
    return org ? normalizeName(org) === compact : false;
  });
  return exactOrg ?? name;
}

function ensureSeededRanking(rows: BoardRankEntry[], seeds: readonly string[]): BoardRankEntry[] {
  const remapped = rows.map((row) => {
    const seed = findSeed(row.name, seeds);
    return seed ? { ...row, name: seed } : { ...row };
  });
  const unique: BoardRankEntry[] = [];
  const seen = new Set<string>();
  for (const row of remapped) {
    const key = subjectKey(row.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  for (const seed of seeds) {
    const key = subjectKey(seed);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      rank: unique.length + 1,
      name: seed,
      score: Number((88 - unique.length * 1.1).toFixed(2)),
      changeRate: Number((((unique.length % 5) - 2) * 1.15).toFixed(2)),
      note: "씨드 보완 · 화제 정책·사업 유지",
    });
  }
  return unique
    .sort((left, right) => right.score - left.score || left.rank - right.rank)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function ensureLocalPolicyRanking(rows: BoardRankEntry[]): BoardRankEntry[] {
  const remapped = rows.map((row) => ({ ...row, name: remapLocalPolicyName(row.name) }));
  return ensureSeededRanking(remapped, LOCAL_POLICY_SEEDS);
}

export function ensureSubsidyRanking(rows: BoardRankEntry[]): BoardRankEntry[] {
  const remapped = rows.map((row) => {
    const seed = findSeed(row.name, SUBSIDY_SEEDS);
    if (seed) return { ...row, name: seed };
    const labeled = parseBracketLabel(row.name);
    if (labeled) return { ...row, name: formatBracketLabel(labeled.org, labeled.subject) };
    return row;
  });
  const labeledOnly = remapped.filter((row) => parseBracketLabel(row.name));
  return ensureSeededRanking(labeledOnly, SUBSIDY_SEEDS);
}

export function ensurePunditRanking(rows: BoardRankEntry[]): BoardRankEntry[] {
  const remapped = rows
    .filter((row) => !matchPoliticsYoutubeSeed(row.name)?.influencer)
    .map((row) => {
      const seed = findSeed(row.name, PUNDIT_SEEDS);
      if (seed) return { ...row, name: seed };
      const tagged = parsePersonTag(row.name);
      if (tagged) return { ...row, name: `${tagged.person} (${tagged.tag})` };
      if (row.name && !parsePersonTag(row.name) && !parseBracketLabel(row.name)) {
        return { ...row, name: `${row.name.trim()} (시사평론가)` };
      }
      return { ...row };
    });
  return ensureSeededRanking(remapped, PUNDIT_SEEDS);
}

export function labeledNameEn(name: string, fallback: string): string {
  const bracket = parseBracketLabel(name);
  if (bracket) return bracket.org;
  const person = parsePersonTag(name);
  if (person) return person.tag;
  return fallback;
}
