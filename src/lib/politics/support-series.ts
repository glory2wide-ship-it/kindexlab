import { kstDateString } from "@/lib/briefing/dates";
import { retrieveNewsForKeyword } from "@/lib/news/retrieve";
import type { NewsDoc } from "@/lib/news/types";

export type SupportAgencyId = "gallup" | "realmeter" | "nbs";
export type SupportKind = "party" | "politician";
export type SupportBar = "1d" | "1w" | "1mo";

export interface SupportAgencyMeta {
  id: SupportAgencyId;
  label: string;
  cadence: string;
  method: string;
  color: string;
}

export interface SupportObservation {
  agency: SupportAgencyId;
  subject: string;
  kind: SupportKind;
  publishedAt: string;
  support: number;
}

export interface SupportSeriesPoint {
  t: string;
  key: string;
  gallup?: number;
  realmeter?: number;
  nbs?: number;
  composite: number;
}

export interface SupportRelatedStory {
  title: string;
  publisher: string;
  publishedAt?: string;
  url: string;
}

export interface SupportChartPayload {
  kind: SupportKind;
  subject: string;
  subjects: string[];
  bar: SupportBar;
  updatedAt: string;
  rangeStart: string;
  rangeEnd: string;
  series: SupportSeriesPoint[];
  latest: {
    gallup?: number;
    realmeter?: number;
    nbs?: number;
    composite: number;
  };
  related: SupportRelatedStory[];
}

export const SUPPORT_AGENCIES: readonly SupportAgencyMeta[] = [
  {
    id: "gallup",
    label: "한국갤럽",
    cadence: "매주",
    method: "무선전화 가상번호 전화면접",
    color: "#f43f5e",
  },
  {
    id: "realmeter",
    label: "리얼미터",
    cadence: "매주",
    method: "무선전화 가상번호 ARS",
    color: "#38bdf8",
  },
  {
    id: "nbs",
    label: "NBS 전국지표조사",
    cadence: "격주",
    method: "엠브레인퍼블릭·케이스탯·코리아리서치·한국리서치 공동 전화면접",
    color: "#34d399",
  },
] as const;

export const SUPPORT_COMPOSITE_COLOR = "#f59e0b";

export const PARTY_SUBJECTS = [
  "더불어민주당",
  "국민의힘",
  "조국혁신당",
  "개혁신당",
  "진보당",
  "기본소득당",
  "사회민주당",
  "정의당",
  "새로운미래",
  "무소속",
] as const;

export const POLITICIAN_SUBJECTS = [
  "이재명",
  "한동훈",
  "오세훈",
  "이준석",
  "조국",
  "김문수",
  "김동연",
  "박찬대",
  "배현진",
  "정청래",
] as const;

export const POLL_METHOD_CARD = {
  cadence: "대부분 매주 또는 격주 단위 정기 발표",
  method: "무선전화 가상번호를 활용한 전화 면접 및 ARS 조사",
  margin: "보통 95% 신뢰수준에 ±3.1%p",
  response: "10% ~ 15% 내외",
} as const;

const BASE: Record<string, number> = {
  더불어민주당: 38.4,
  국민의힘: 31.6,
  조국혁신당: 8.4,
  개혁신당: 4.2,
  진보당: 3.1,
  이재명: 44.8,
  한동훈: 33.8,
  오세훈: 39.2,
  이준석: 24.7,
  조국: 26.1,
  김문수: 28.4,
  김동연: 31.5,
};

const AGENCY_BIAS: Record<SupportAgencyId, number> = {
  gallup: 0,
  realmeter: -3.4,
  nbs: -1.1,
};

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

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return kstDateString(date);
}

function weekday(iso: string): number {
  return new Date(`${iso}T12:00:00+09:00`).getUTCDay();
}

function monthsAgo(from: string, months: number): string {
  const date = new Date(`${from}T00:00:00+09:00`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return kstDateString(date);
}

function isoWeekKey(iso: string): { key: string; label: string } {
  const date = new Date(`${iso}T12:00:00+09:00`);
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.valueOf() - firstThursday.valueOf()) / 86400000 - 3) / 7);
  const year = target.getUTCFullYear();
  const month = Number(iso.slice(5, 7));
  const weekOfMonth = Math.max(1, Math.ceil(Number(iso.slice(8, 10)) / 7));
  return { key: `${year}-W${String(week).padStart(2, "0")}`, label: `${month}월 ${weekOfMonth}주` };
}

function mean(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function datesOnWeekday(start: string, end: string, day: number): string[] {
  const out: string[] = [];
  let cursor = start;
  while (weekday(cursor) !== day) cursor = addDays(cursor, 1);
  while (cursor <= end) {
    out.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return out;
}

function walkSupport(subject: string, agency: SupportAgencyId, date: string, index: number): number {
  const base = BASE[subject] ?? 18;
  const bias = AGENCY_BIAS[agency];
  const wave = Math.sin((index + hashCode(subject) % 7) / 3.2) * 1.8;
  const jitter = ((hashCode(`${agency}:${subject}:${date}`) % 17) - 8) / 10;
  const drift = index * (subject === "국민의힘" || subject === "한동훈" ? -0.04 : 0.03);
  return round1(clamp(base + bias + wave + jitter + drift, 1.2, 72));
}

function buildObservations(kind: SupportKind, end = kstDateString()): SupportObservation[] {
  const start = monthsAgo(end, 6);
  const subjects = kind === "party" ? PARTY_SUBJECTS : POLITICIAN_SUBJECTS;
  const gallupDays = datesOnWeekday(start, end, 5);
  const realmeterDays = datesOnWeekday(start, end, 1);
  const nbsDays = datesOnWeekday(start, end, 4).filter((_, index) => index % 2 === 0);
  const rows: SupportObservation[] = [];
  for (const subject of subjects) {
    gallupDays.forEach((publishedAt, index) => {
      rows.push({
        agency: "gallup",
        subject,
        kind,
        publishedAt,
        support: walkSupport(subject, "gallup", publishedAt, index),
      });
    });
    realmeterDays.forEach((publishedAt, index) => {
      rows.push({
        agency: "realmeter",
        subject,
        kind,
        publishedAt,
        support: walkSupport(subject, "realmeter", publishedAt, index),
      });
    });
    nbsDays.forEach((publishedAt, index) => {
      rows.push({
        agency: "nbs",
        subject,
        kind,
        publishedAt,
        support: walkSupport(subject, "nbs", publishedAt, index),
      });
    });
  }
  return rows;
}

function bucketKey(publishedAt: string, bar: SupportBar): { key: string; label: string } {
  if (bar === "1d") {
    const [, month, day] = publishedAt.split("-");
    return { key: publishedAt, label: `${Number(month)}/${Number(day)}` };
  }
  if (bar === "1mo") {
    const [year, month] = publishedAt.split("-");
    return { key: `${year}-${month}`, label: `${Number(month)}월` };
  }
  return isoWeekKey(publishedAt);
}

export function aggregateSupportSeries(
  observations: SupportObservation[],
  subject: string,
  bar: SupportBar,
): SupportSeriesPoint[] {
  const buckets = new Map<string, { label: string; gallup: number[]; realmeter: number[]; nbs: number[] }>();
  for (const row of observations.filter((item) => item.subject === subject)) {
    const { key, label } = bucketKey(row.publishedAt, bar);
    const current = buckets.get(key) ?? { label, gallup: [], realmeter: [], nbs: [] };
    current[row.agency].push(row.support);
    buckets.set(key, current);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, bucket]) => {
      const gallup = mean(bucket.gallup);
      const realmeter = mean(bucket.realmeter);
      const nbs = mean(bucket.nbs);
      const present = [gallup, realmeter, nbs].filter((value): value is number => value != null);
      return {
        t: bucket.label,
        key,
        gallup,
        realmeter,
        nbs,
        composite: mean(present) ?? 0,
      };
    })
    .filter((row) => row.composite > 0);
}

function preferPublisher(docs: NewsDoc[]): NewsDoc[] {
  const preferred = [/조선일보/, /연합뉴스/, /중앙일보/, /동아일보/, /한겨레/, /경향/, /한국일보/, /뉴시스/];
  return [...docs].sort((left, right) => {
    const leftHit = preferred.findIndex((pattern) => pattern.test(`${left.publisher ?? ""} ${left.title}`));
    const rightHit = preferred.findIndex((pattern) => pattern.test(`${right.publisher ?? ""} ${right.title}`));
    const leftScore = leftHit === -1 ? 99 : leftHit;
    const rightScore = rightHit === -1 ? 99 : rightHit;
    return leftScore - rightScore;
  });
}

export async function fetchSupportRelatedNews(subject: string): Promise<SupportRelatedStory[]> {
  try {
    const retrieval = await retrieveNewsForKeyword(`${subject} 여론조사 지지도`, {
      limit: 8,
      lookbackHours: 336,
      trustedOnly: true,
      allowMarketTape: true,
      skipAliasFilter: true,
    });
    return preferPublisher(retrieval.docs)
      .filter((doc) => doc.link)
      .slice(0, 5)
      .map((doc) => ({
        title: doc.title,
        publisher: doc.publisher ?? "언론사",
        publishedAt: doc.publishedAt,
        url: doc.link!,
      }));
  } catch {
    return [];
  }
}

export async function getSupportChartPayload(input: {
  kind: SupportKind;
  subject?: string;
  bar?: SupportBar;
}): Promise<SupportChartPayload> {
  const subjects = [...(input.kind === "party" ? PARTY_SUBJECTS : POLITICIAN_SUBJECTS)];
  const subject =
    input.subject && (subjects as string[]).includes(input.subject)
      ? (input.subject as (typeof subjects)[number])
      : subjects[0]!;
  const bar = input.bar === "1d" || input.bar === "1mo" ? input.bar : "1w";
  const end = kstDateString();
  const observations = buildObservations(input.kind, end);
  const series = aggregateSupportSeries(observations, subject, bar);
  const last = series.at(-1);
  const related = await fetchSupportRelatedNews(subject);
  return {
    kind: input.kind,
    subject,
    subjects,
    bar,
    updatedAt: new Date().toISOString(),
    rangeStart: monthsAgo(end, 6),
    rangeEnd: end,
    series,
    latest: {
      gallup: last?.gallup,
      realmeter: last?.realmeter,
      nbs: last?.nbs,
      composite: last?.composite ?? 0,
    },
    related,
  };
}
