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
  홍준표: "국민의힘",
  나경원: "국민의힘",
  장동혁: "국민의힘",
  김민석: "더불어민주당",
  원희룡: "국민의힘",
  심상정: "정의당",
  김기현: "국민의힘",
  고민정: "더불어민주당",
  추미애: "더불어민주당",
  우원식: "더불어민주당",
  김경수: "더불어민주당",
  유승민: "국민의힘",
  추경호: "국민의힘",
  김재섭: "국민의힘",
  천하람: "개혁신당",
  용혜인: "기본소득당",
  서영교: "더불어민주당",
  박주민: "더불어민주당",
  전현희: "더불어민주당",
  강훈식: "더불어민주당",
  김동철: "더불어민주당",
  박용진: "더불어민주당",
  송언석: "국민의힘",
  김두관: "더불어민주당",
};

export function politicianPartyName(name: string): string | undefined {
  const cleaned = name.replace(/^\[[^\]]+\]\s*/, "").replace(/\s+/g, "").trim();
  if (!cleaned) return undefined;
  if (POLITICIAN_PARTY[cleaned]) return POLITICIAN_PARTY[cleaned];
  const key = normalizeName(cleaned);
  // Exact normalized match only — never substring (조국 ⊂ 조국혁신당).
  for (const [person, party] of Object.entries(POLITICIAN_PARTY)) {
    if (normalizeName(person) === key) return party;
  }
  return undefined;
}
