/**
 * Politician → affiliated party for heatmap rank chips.
 * Paint-only; not an official poll affiliation feed.
 */

import { normalizeName } from "@/lib/ingestion/names";

const POLITICIAN_PARTY: Record<string, string> = {
  이재명: "더불어민주당",
  김문수: "국민의힘",
  한동훈: "국민의힘",
  이준석: "개혁신당",
  조국: "조국혁신당",
  오세훈: "국민의힘",
  김동연: "더불어민주당",
  박찬대: "더불어민주당",
  배현진: "국민의힘",
  정청래: "더불어민주당",
  윤석열: "국민의힘",
  이낙연: "새로운미래",
  안철수: "국민의힘",
};

export function politicianPartyName(name: string): string | undefined {
  const cleaned = name.replace(/^\[[^\]]+\]\s*/, "").replace(/\s+/g, "").trim();
  if (!cleaned) return undefined;
  if (POLITICIAN_PARTY[cleaned]) return POLITICIAN_PARTY[cleaned];
  const key = normalizeName(cleaned);
  for (const [person, party] of Object.entries(POLITICIAN_PARTY)) {
    if (normalizeName(person) === key || cleaned.includes(person)) return party;
  }
  return undefined;
}
