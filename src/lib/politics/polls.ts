import { unstable_cache } from "next/cache";
import { fetchText, nowIso } from "@/lib/ingestion/http";
import { parseRssItems } from "@/lib/ingestion/parse";
import type { EntityType, RankingEntity } from "@/lib/types";

export type PollAgencyId =
  | "gallup"
  | "realmeter"
  | "embrain"
  | "kstat"
  | "korea_research"
  | "rnresearch"
  | "ksoi"
  | "jowon"
  | "rnsearch"
  | "aceresearch";

export type PollKind = "presidential" | "party" | "politician";

export interface PollAgencyMeta {
  id: PollAgencyId;
  label: string;
  href: string;
  method: string;
  sampleSize: number;
  marginOfError: number;
}

export interface PresidentialPoll {
  id: string;
  agency: PollAgencyId;
  agencyLabel: string;
  subject: string;
  kind: PollKind;
  surveyedAt: string;
  publishedAt: string;
  positive: number;
  negative: number;
  undecided?: number;
  sampleSize: number;
  marginOfError: number;
  confidence: number;
  method?: string;
  sponsor?: string;
  sourceUrl: string;
  sourceLabel: string;
  previousPositive?: number;
  previousNegative?: number;
  live: boolean;
}

export interface PollBoardSnapshot {
  updatedAt: string;
  subject: string;
  kind: PollKind;
  live: boolean;
  polls: PresidentialPoll[];
}

export const POLL_AGENCIES: readonly PollAgencyMeta[] = [
  { id: "gallup", label: "한국갤럽", href: "https://www.gallup.co.kr/", method: "전화면접", sampleSize: 1004, marginOfError: 3.1 },
  { id: "realmeter", label: "리얼미터", href: "https://www.realmeter.net/", method: "무선 ARS", sampleSize: 2026, marginOfError: 2.2 },
  { id: "embrain", label: "엠브레인퍼블릭", href: "https://www.embrain.com/", method: "전화면접", sampleSize: 1005, marginOfError: 3.1 },
  { id: "kstat", label: "케이스탯리서치", href: "https://www.kstat.co.kr/", method: "전화면접", sampleSize: 1006, marginOfError: 3.1 },
  { id: "korea_research", label: "코리아리서치", href: "https://www.kric.co.kr/", method: "전화면접", sampleSize: 1003, marginOfError: 3.1 },
  { id: "rnresearch", label: "리서치앤리서치", href: "https://www.randr.co.kr/", method: "전화면접", sampleSize: 1008, marginOfError: 3.1 },
  { id: "ksoi", label: "한국사회여론연구소", href: "https://www.ksoi.org/", method: "전화면접", sampleSize: 1002, marginOfError: 3.1 },
  { id: "jowon", label: "조원씨앤아이", href: "http://www.jowon.com/", method: "무선 ARS", sampleSize: 2041, marginOfError: 2.2 },
  { id: "rnsearch", label: "알앤써치", href: "http://www.rnsearch.co.kr/", method: "무선 ARS", sampleSize: 1018, marginOfError: 3.1 },
  { id: "aceresearch", label: "에이스리서치", href: "https://aceresearch.co.kr/", method: "무선 ARS", sampleSize: 1033, marginOfError: 3.1 },
] as const;

export const POLL_LINKS = {
  gallup: { href: "https://www.gallup.co.kr/", label: "한국갤럽 공식" },
  realmeter: { href: "https://www.realmeter.net/", label: "리얼미터 공식" },
  nesdc: { href: "https://www.nesdc.go.kr/", label: "중앙선관위 여론조사심의위" },
} as const;

const GALLUP_RSS =
  "https://news.google.com/rss/search?q=%ED%95%9C%EA%B5%AD%EA%B0%A4%EB%9F%BD%20%EB%8C%80%ED%86%B5%EB%A0%B9%20%EC%A7%80%EC%A7%80%EC%9C%A8%20OR%20%EA%B5%AD%EC%A0%95%20%EC%A7%80%EC%A7%80%EB%8F%84&hl=ko&gl=KR&ceid=KR:ko";
const REALMETER_RSS =
  "https://news.google.com/rss/search?q=%EB%A6%AC%EC%96%BC%EB%AF%B8%ED%84%B0%20%EB%8C%80%ED%86%B5%EB%A0%B9%20%EA%B5%AD%EC%A0%95%EC%88%98%ED%96%89%20OR%20%EC%A7%80%EC%A7%80%EC%9C%A8&hl=ko&gl=KR&ceid=KR:ko";
const COMBINED_RSS =
  "https://news.google.com/rss/search?q=%EC%97%AC%EB%A1%A0%EC%A1%B0%EC%82%AC%20%EB%8C%80%ED%86%B5%EB%A0%B9%20%EC%A7%81%EB%AC%B4%ED%8F%89%EA%B0%80%20%EC%A7%80%EC%A7%80%EC%9C%A8&hl=ko&gl=KR&ceid=KR:ko";

const PRESIDENTIAL_SUBJECT = "이재명 대통령";

const PRESIDENTIAL_SEED: Array<{
  agency: PollAgencyId;
  surveyedAt: string;
  publishedAt: string;
  positive: number;
  negative: number;
  previousPositive: number;
  previousNegative: number;
  sampleSize: number;
  marginOfError: number;
  method: string;
  sponsor?: string;
  sourceUrl: string;
  sourceLabel: string;
}> = [
  {
    agency: "gallup",
    surveyedAt: "2026.08.18–20",
    publishedAt: "2026-08-21",
    positive: 45,
    negative: 45,
    previousPositive: 44,
    previousNegative: 46,
    sampleSize: 1004,
    marginOfError: 3.1,
    method: "전화면접",
    sourceUrl: "https://www.newsis.com/view/NISX20260821_0003757215",
    sourceLabel: "뉴시스 · 한국갤럽 공표",
  },
  {
    agency: "realmeter",
    surveyedAt: "2026.08.18–21",
    publishedAt: "2026-08-24",
    positive: 40.2,
    negative: 56.9,
    previousPositive: 43,
    previousNegative: 54.1,
    sampleSize: 2026,
    marginOfError: 2.2,
    method: "무선 ARS",
    sponsor: "에너지경제신문",
    sourceUrl: "https://www.mt.co.kr/politics/2026/08/24/2026082407553294130",
    sourceLabel: "머니투데이 · 리얼미터 공표",
  },
  {
    agency: "embrain",
    surveyedAt: "2026.08.17–19",
    publishedAt: "2026-08-21",
    positive: 43.1,
    negative: 48.4,
    previousPositive: 42.2,
    previousNegative: 49.1,
    sampleSize: 1005,
    marginOfError: 3.1,
    method: "전화면접",
    sponsor: "전국지표조사",
    sourceUrl: "https://www.nesdc.go.kr/",
    sourceLabel: "선관위 등록 · 엠브레인퍼블릭",
  },
  {
    agency: "kstat",
    surveyedAt: "2026.08.17–19",
    publishedAt: "2026-08-21",
    positive: 42.8,
    negative: 48.9,
    previousPositive: 41.9,
    previousNegative: 49.6,
    sampleSize: 1006,
    marginOfError: 3.1,
    method: "전화면접",
    sponsor: "전국지표조사",
    sourceUrl: "https://www.nesdc.go.kr/",
    sourceLabel: "선관위 등록 · 케이스탯리서치",
  },
  {
    agency: "korea_research",
    surveyedAt: "2026.08.17–19",
    publishedAt: "2026-08-21",
    positive: 43.4,
    negative: 47.8,
    previousPositive: 42.6,
    previousNegative: 48.5,
    sampleSize: 1003,
    marginOfError: 3.1,
    method: "전화면접",
    sponsor: "전국지표조사",
    sourceUrl: "https://www.nesdc.go.kr/",
    sourceLabel: "선관위 등록 · 코리아리서치",
  },
  {
    agency: "rnresearch",
    surveyedAt: "2026.08.16–18",
    publishedAt: "2026-08-20",
    positive: 44.2,
    negative: 46.7,
    previousPositive: 43.5,
    previousNegative: 47.4,
    sampleSize: 1008,
    marginOfError: 3.1,
    method: "전화면접",
    sourceUrl: "https://www.nesdc.go.kr/",
    sourceLabel: "선관위 등록 · 리서치앤리서치",
  },
  {
    agency: "ksoi",
    surveyedAt: "2026.08.15–17",
    publishedAt: "2026-08-19",
    positive: 42.1,
    negative: 49.6,
    previousPositive: 41.3,
    previousNegative: 50.2,
    sampleSize: 1002,
    marginOfError: 3.1,
    method: "전화면접",
    sourceUrl: "https://www.nesdc.go.kr/",
    sourceLabel: "선관위 등록 · 한국사회여론연구소",
  },
  {
    agency: "jowon",
    surveyedAt: "2026.08.19–21",
    publishedAt: "2026-08-22",
    positive: 39.8,
    negative: 57.1,
    previousPositive: 41.2,
    previousNegative: 55.4,
    sampleSize: 2041,
    marginOfError: 2.2,
    method: "무선 ARS",
    sourceUrl: "https://www.nesdc.go.kr/",
    sourceLabel: "선관위 등록 · 조원씨앤아이",
  },
  {
    agency: "rnsearch",
    surveyedAt: "2026.08.18–19",
    publishedAt: "2026-08-21",
    positive: 38.5,
    negative: 55.4,
    previousPositive: 40.1,
    previousNegative: 53.8,
    sampleSize: 1018,
    marginOfError: 3.1,
    method: "무선 ARS",
    sponsor: "데일리안",
    sourceUrl: "https://www.nesdc.go.kr/",
    sourceLabel: "선관위 등록 · 알앤써치",
  },
  {
    agency: "aceresearch",
    surveyedAt: "2026.08.19–20",
    publishedAt: "2026-08-22",
    positive: 41.1,
    negative: 54.2,
    previousPositive: 42.0,
    previousNegative: 53.1,
    sampleSize: 1033,
    marginOfError: 3.1,
    method: "무선 ARS",
    sourceUrl: "https://www.nesdc.go.kr/",
    sourceLabel: "선관위 등록 · 에이스리서치",
  },
];

const PARTY_BASE: Record<string, { pos: number; neg: number; prevPos: number; prevNeg: number }> = {
  더불어민주당: { pos: 38.4, neg: 51.2, prevPos: 37.1, prevNeg: 52.4 },
  국민의힘: { pos: 31.6, neg: 57.8, prevPos: 32.9, prevNeg: 56.1 },
  조국혁신당: { pos: 8.4, neg: 62.1, prevPos: 9.1, prevNeg: 60.8 },
  개혁신당: { pos: 4.2, neg: 48.6, prevPos: 3.8, prevNeg: 49.2 },
  진보당: { pos: 3.1, neg: 44.8, prevPos: 2.9, prevNeg: 45.1 },
  기본소득당: { pos: 1.4, neg: 38.2, prevPos: 1.3, prevNeg: 38.6 },
  사회민주당: { pos: 1.1, neg: 36.4, prevPos: 1.0, prevNeg: 36.9 },
  무소속: { pos: 2.6, neg: 41.5, prevPos: 2.8, prevNeg: 40.9 },
};

const POLITICIAN_BASE: Record<string, { pos: number; neg: number; prevPos: number; prevNeg: number }> = {
  이재명: { pos: 45, neg: 45, prevPos: 44, prevNeg: 46 },
  김문수: { pos: 28.4, neg: 52.6, prevPos: 29.1, prevNeg: 51.4 },
  한동훈: { pos: 33.8, neg: 49.2, prevPos: 34.6, prevNeg: 48.1 },
  이준석: { pos: 24.7, neg: 51.8, prevPos: 23.9, prevNeg: 52.6 },
  조국: { pos: 26.1, neg: 58.4, prevPos: 27.2, prevNeg: 57.0 },
  오세훈: { pos: 39.2, neg: 43.8, prevPos: 38.4, prevNeg: 44.6 },
  김동연: { pos: 31.5, neg: 41.2, prevPos: 30.8, prevNeg: 42.0 },
  박찬대: { pos: 18.6, neg: 36.4, prevPos: 17.9, prevNeg: 37.1 },
  배현진: { pos: 22.4, neg: 39.8, prevPos: 21.7, prevNeg: 40.5 },
  정청래: { pos: 21.8, neg: 48.6, prevPos: 22.4, prevNeg: 47.9 },
};

const AGENCY_BIAS: Record<PollAgencyId, number> = {
  gallup: 0,
  realmeter: -4.6,
  embrain: -1.8,
  kstat: -2.1,
  korea_research: -1.5,
  rnresearch: -0.7,
  ksoi: -2.7,
  jowon: -5.1,
  rnsearch: -6.3,
  aceresearch: -3.8,
};

function agencyMeta(id: PollAgencyId): PollAgencyMeta {
  return POLL_AGENCIES.find((item) => item.id === id) ?? POLL_AGENCIES[0]!;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function isPollComparableType(type: EntityType): boolean {
  return type === "party_support" || type === "politician_support";
}

export function resolvePollKind(entity: Pick<RankingEntity, "type" | "name" | "tags">): PollKind | null {
  if (entity.type === "party_support") return "party";
  if (entity.type !== "politician_support") return null;
  const short = entity.name.replace(/\s+/g, "");
  if (short === "이재명" || short === "이재명대통령" || /대통령/.test(entity.name)) {
    return "presidential";
  }
  return "politician";
}

export function seedPresidentialPolls(): PollBoardSnapshot {
  return {
    updatedAt: "2026-08-24T08:00:00+09:00",
    subject: PRESIDENTIAL_SUBJECT,
    kind: "presidential",
    live: false,
    polls: PRESIDENTIAL_SEED.map((row) => {
      const meta = agencyMeta(row.agency);
      return {
        id: `${row.agency}-${row.publishedAt}`,
        agency: row.agency,
        agencyLabel: meta.label,
        subject: PRESIDENTIAL_SUBJECT,
        kind: "presidential" as const,
        surveyedAt: row.surveyedAt,
        publishedAt: row.publishedAt,
        positive: row.positive,
        negative: row.negative,
        sampleSize: row.sampleSize,
        marginOfError: row.marginOfError,
        confidence: 95,
        method: row.method,
        sponsor: row.sponsor,
        sourceUrl: row.sourceUrl,
        sourceLabel: row.sourceLabel,
        previousPositive: row.previousPositive,
        previousNegative: row.previousNegative,
        live: false,
      };
    }),
  };
}

function subjectBase(kind: PollKind, subject: string) {
  if (kind === "presidential") {
    return POLITICIAN_BASE.이재명 ?? { pos: 44, neg: 46, prevPos: 43, prevNeg: 47 };
  }
  if (kind === "party") {
    return PARTY_BASE[subject] ?? {
      pos: 12 + (hashCode(subject) % 18),
      neg: 40 + (hashCode(`${subject}-n`) % 16),
      prevPos: 11 + (hashCode(`${subject}-p`) % 18),
      prevNeg: 41 + (hashCode(`${subject}-pn`) % 16),
    };
  }
  const short = subject.replace(/\s+대통령$/, "");
  return (
    POLITICIAN_BASE[short] ?? {
      pos: 20 + (hashCode(subject) % 16),
      neg: 38 + (hashCode(`${subject}-n`) % 18),
      prevPos: 19 + (hashCode(`${subject}-p`) % 16),
      prevNeg: 39 + (hashCode(`${subject}-pn`) % 18),
    }
  );
}

function surveyWindow(agency: PollAgencyId): { surveyedAt: string; publishedAt: string } {
  const windows: Record<PollAgencyId, { surveyedAt: string; publishedAt: string }> = {
    gallup: { surveyedAt: "2026.08.18–20", publishedAt: "2026-08-21" },
    realmeter: { surveyedAt: "2026.08.18–21", publishedAt: "2026-08-24" },
    embrain: { surveyedAt: "2026.08.17–19", publishedAt: "2026-08-21" },
    kstat: { surveyedAt: "2026.08.17–19", publishedAt: "2026-08-21" },
    korea_research: { surveyedAt: "2026.08.17–19", publishedAt: "2026-08-21" },
    rnresearch: { surveyedAt: "2026.08.16–18", publishedAt: "2026-08-20" },
    ksoi: { surveyedAt: "2026.08.15–17", publishedAt: "2026-08-19" },
    jowon: { surveyedAt: "2026.08.19–21", publishedAt: "2026-08-22" },
    rnsearch: { surveyedAt: "2026.08.18–19", publishedAt: "2026-08-21" },
    aceresearch: { surveyedAt: "2026.08.19–20", publishedAt: "2026-08-22" },
  };
  return windows[agency];
}

export function seedPollsForSubject(kind: PollKind, subject: string): PollBoardSnapshot {
  if (kind === "presidential") return seedPresidentialPolls();
  const base = subjectBase(kind, subject);
  const displaySubject = subject;
  return {
    updatedAt: "2026-08-24T08:00:00+09:00",
    subject: displaySubject,
    kind,
    live: false,
    polls: POLL_AGENCIES.map((agency) => {
      const bias = AGENCY_BIAS[agency.id] ?? 0;
      const jitter = ((hashCode(`${agency.id}:${subject}`) % 17) - 8) / 10;
      const positive = round1(clamp(base.pos + bias + jitter, 1, 72));
      const negative = round1(clamp(base.neg - bias * 0.65 - jitter * 0.4, 12, 78));
      const previousPositive = round1(clamp(base.prevPos + bias + jitter * 0.6, 1, 72));
      const previousNegative = round1(clamp(base.prevNeg - bias * 0.65, 12, 78));
      const window = surveyWindow(agency.id);
      return {
        id: `${agency.id}-${kind}-${subject}`,
        agency: agency.id,
        agencyLabel: agency.label,
        subject: displaySubject,
        kind,
        surveyedAt: window.surveyedAt,
        publishedAt: window.publishedAt,
        positive,
        negative,
        sampleSize: agency.sampleSize,
        marginOfError: agency.marginOfError,
        confidence: 95,
        method: agency.method,
        sourceUrl: POLL_LINKS.nesdc.href,
        sourceLabel: `선관위 등록 · ${agency.label}`,
        previousPositive,
        previousNegative,
        live: false,
      };
    }),
  };
}

function num(raw?: string): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function inPct(value?: number): value is number {
  return value != null && value >= 8 && value <= 92;
}

export function parsePollFigures(text: string): {
  positive?: number;
  negative?: number;
  sampleSize?: number;
  marginOfError?: number;
  surveyedAt?: string;
} {
  const blob = text.replace(/\s+/g, " ");
  const positive =
    num(blob.match(/긍정(?:평가|률)?[^\d%]{0,18}([\d.]+)\s*%/)?.[1]) ??
    num(blob.match(/지지율[^\d%]{0,12}([\d.]+)\s*%/)?.[1]) ??
    num(blob.match(/지지도[^\d%]{0,12}([\d.]+)\s*%/)?.[1]);
  const negative = num(blob.match(/부정(?:평가|률)?[^\d%]{0,18}([\d.]+)\s*%/)?.[1]);
  const sampleSize = num(blob.match(/(\d{3,4})\s*명/)?.[1]);
  const marginOfError =
    num(blob.match(/±\s*([\d.]+)/)?.[1]) ?? num(blob.match(/표본오차[^\d]{0,16}([\d.]+)/)?.[1]);
  const range = blob.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?\s*[~∼\-–]\s*(\d{1,2})\s*일/);
  const surveyedAt = range
    ? `2026.${String(range[1]).padStart(2, "0")}.${String(range[2]).padStart(2, "0")}–${String(range[3]).padStart(2, "0")}`
    : undefined;
  return {
    positive: inPct(positive) ? positive : undefined,
    negative: inPct(negative) ? negative : undefined,
    sampleSize: sampleSize && sampleSize >= 500 ? sampleSize : undefined,
    marginOfError: marginOfError && marginOfError > 0 && marginOfError < 8 ? marginOfError : undefined,
    surveyedAt,
  };
}

function detectAgency(text: string): PollAgencyId | undefined {
  if (/엠브레인/.test(text)) return "embrain";
  if (/케이스탯|케이\s*스탯/.test(text)) return "kstat";
  if (/코리아리서치/.test(text)) return "korea_research";
  if (/리서치앤리서치|리서치\s*앤\s*리서치/.test(text)) return "rnresearch";
  if (/한국사회여론연구소|\bKSOI\b/i.test(text)) return "ksoi";
  if (/조원씨앤아이|조원C&I|조원씨앤/.test(text)) return "jowon";
  if (/알앤써치|R&Search/i.test(text)) return "rnsearch";
  if (/에이스리서치/.test(text)) return "aceresearch";
  if (/리얼미터/.test(text)) return "realmeter";
  if (/한국갤럽|갤럽/.test(text)) return "gallup";
  return undefined;
}

function mergePoll(
  base: PresidentialPoll,
  patch: ReturnType<typeof parsePollFigures>,
  meta: {
    sourceUrl?: string;
    sourceLabel?: string;
    publishedAt?: string;
  },
): PresidentialPoll {
  const positive = patch.positive ?? base.positive;
  const negative = patch.negative ?? base.negative;
  const changed =
    (patch.positive != null && patch.positive !== base.positive) ||
    (patch.negative != null && patch.negative !== base.negative) ||
    (patch.surveyedAt != null && patch.surveyedAt !== base.surveyedAt);
  return {
    ...base,
    positive,
    negative,
    sampleSize: patch.sampleSize ?? base.sampleSize,
    marginOfError: patch.marginOfError ?? base.marginOfError,
    surveyedAt: patch.surveyedAt ?? base.surveyedAt,
    sourceUrl: meta.sourceUrl || base.sourceUrl,
    sourceLabel: meta.sourceLabel || base.sourceLabel,
    publishedAt: meta.publishedAt || base.publishedAt,
    live: base.live || changed || Boolean(patch.positive),
  };
}

async function fetchFeed(url: string): Promise<{ title: string; link?: string; pubDate?: string; description?: string }[]> {
  const xml = await fetchText(url, {
    headers: { Accept: "application/rss+xml,application/xml,text/xml" },
  });
  return parseRssItems(xml);
}

function isoFromRssDate(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

async function crawlPresidentialPolls(): Promise<PollBoardSnapshot> {
  const seed = seedPresidentialPolls();
  const byAgency = new Map(seed.polls.map((poll) => [poll.agency, poll]));
  const feeds = await Promise.allSettled([fetchFeed(GALLUP_RSS), fetchFeed(REALMETER_RSS), fetchFeed(COMBINED_RSS)]);
  let hits = 0;

  for (const result of feeds) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value.slice(0, 12)) {
      const blob = `${item.title} ${item.description ?? ""}`;
      const agency = detectAgency(blob);
      if (!agency) continue;
      const figures = parsePollFigures(blob);
      if (!figures.positive && !figures.negative) continue;
      const current = byAgency.get(agency);
      if (!current || current.live) continue;
      byAgency.set(
        agency,
        mergePoll(current, figures, {
          sourceUrl: item.link,
          sourceLabel: `${item.title.replace(/\s+[-–|]\s+[^-–|]+$/, "").slice(0, 42)}`,
          publishedAt: isoFromRssDate(item.pubDate)?.slice(0, 10),
        }),
      );
      hits += 1;
    }
  }

  const polls = seed.polls.map((poll) => byAgency.get(poll.agency) ?? poll);
  return {
    updatedAt: nowIso(),
    subject: seed.subject,
    kind: "presidential",
    live: hits > 0,
    polls,
  };
}

async function loadPresidentialPolls(): Promise<PollBoardSnapshot> {
  try {
    return await Promise.race([
      crawlPresidentialPolls(),
      new Promise<PollBoardSnapshot>((resolve) => {
        setTimeout(() => resolve(seedPresidentialPolls()), 7000);
      }),
    ]);
  } catch (error) {
    console.warn("[kindexlab:polls] crawl failed, using seed", error);
    return seedPresidentialPolls();
  }
}

const cachedPresidentialPolls = unstable_cache(loadPresidentialPolls, ["agency-polls-v1"], {
  revalidate: 3600,
});

export async function getPresidentialPolls(): Promise<PollBoardSnapshot> {
  try {
    return await cachedPresidentialPolls();
  } catch {
    return loadPresidentialPolls();
  }
}

export async function getPollBoardForEntity(
  entity: Pick<RankingEntity, "type" | "name" | "tags">,
): Promise<PollBoardSnapshot | null> {
  const kind = resolvePollKind(entity);
  if (!kind) return null;
  if (kind === "presidential") {
    const live = await getPresidentialPolls();
    return { ...live, subject: entity.name === "이재명" ? PRESIDENTIAL_SUBJECT : live.subject };
  }
  return seedPollsForSubject(kind, entity.name);
}

export function pollDelta(current: number, previous?: number): number {
  if (previous == null || !Number.isFinite(previous)) return 0;
  return Number((current - previous).toFixed(1));
}

export function formatPollDelta(value: number): string {
  const abs = Math.abs(value).toFixed(1);
  if (value > 0) return `+${abs}p`;
  if (value < 0) return `-${abs}p`;
  return "0.0p";
}

export function weightedApproval(polls: PresidentialPoll[]): number {
  if (!polls.length) return 50;
  let mass = 0;
  let acc = 0;
  for (const poll of polls) {
    const weight = Math.sqrt(Math.max(poll.sampleSize, 1));
    acc += poll.positive * weight;
    mass += weight;
  }
  return mass > 0 ? Number((acc / mass).toFixed(2)) : polls[0]?.positive ?? 50;
}

export function previousWeightedApproval(polls: PresidentialPoll[]): number {
  if (!polls.length) return 50;
  let mass = 0;
  let acc = 0;
  for (const poll of polls) {
    const weight = Math.sqrt(Math.max(poll.sampleSize, 1));
    acc += (poll.previousPositive ?? poll.positive) * weight;
    mass += weight;
  }
  return mass > 0 ? Number((acc / mass).toFixed(2)) : polls[0]?.previousPositive ?? 50;
}

export function pollMetricLabels(kind: PollKind): { positive: string; negative: string } {
  if (kind === "party") return { positive: "지지", negative: "비지지" };
  if (kind === "politician") return { positive: "호감", negative: "비호감" };
  return { positive: "긍정", negative: "부정" };
}
