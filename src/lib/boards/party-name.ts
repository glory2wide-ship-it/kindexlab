/**
 * Party-support board guards — only real party names, not politicians or issue keywords.
 */

import { normalizeName } from "@/lib/ingestion/names";
import { PARTY_SUBJECTS } from "@/lib/politics/support-series";
import { POLITICS_CATALOG } from "@/lib/politics/catalog";

const PARTY_ALIASES: Record<string, string> = {
  국힘: "국민의힘",
  민주당: "더불어민주당",
  더민주: "더불어민주당",
  개혁당: "개혁신당",
  조국당: "조국혁신당",
  혁신당: "조국혁신당",
};

/** Known politicians that must never sit on the party-support board (exact name). */
const POLITICIAN_NOT_PARTY = new Set(
  POLITICS_CATALOG.filter((entry) => entry.type === "politician_support")
    .map((entry) => normalizeName(entry.name))
    .concat(
      [
        "조국",
        "이재명",
        "한동훈",
        "이준석",
        "오세훈",
        "김문수",
        "홍준표",
        "나경원",
        "장동혁",
        "김민석",
        "원희룡",
        "심상정",
        "추미애",
        "고민정",
        "안철수",
        "이낙연",
        "윤석열",
      ].map((name) => normalizeName(name)),
    ),
);

function partyCanon(name: string): string | undefined {
  const cleaned = name.replace(/^\[[^\]]+\]\s*/, "").trim();
  if (!cleaned) return undefined;
  const compact = normalizeName(cleaned);
  if (PARTY_ALIASES[cleaned]) return PARTY_ALIASES[cleaned];
  if (PARTY_ALIASES[compact]) return PARTY_ALIASES[compact];
  for (const party of PARTY_SUBJECTS) {
    if (normalizeName(party) === compact) return party;
  }
  for (const entry of POLITICS_CATALOG) {
    if (entry.type !== "party_support") continue;
    if (normalizeName(entry.name) === compact) return entry.name;
    if (entry.aliases?.some((alias) => normalizeName(alias) === compact)) return entry.name;
  }
  return undefined;
}

/**
 * Exact / alias party match — never substring (blocks `조국` vs `조국혁신당`).
 */
export function partyNamesEqual(a: string, b: string): boolean {
  const left = partyCanon(a) ?? normalizeName(a);
  const right = partyCanon(b) ?? normalizeName(b);
  if (!left || !right) return false;
  return normalizeName(left) === normalizeName(right);
}

/**
 * True when the name is a party (or known alias), not a politician / issue keyword.
 * Exact match only — blocks `기본소득` (issue) vs `기본소득당` (party), and `조국` (person).
 */
export function isLikelyPartyName(name: string): boolean {
  const cleaned = name.replace(/^\[[^\]]+\]\s*/, "").trim();
  if (!cleaned || cleaned.length > 24) return false;
  const compact = normalizeName(cleaned);
  if (!compact) return false;
  // Politicians must never pass even if a party name contains their name as a substring.
  if (POLITICIAN_NOT_PARTY.has(compact)) return false;
  return partyCanon(cleaned) != null;
}
