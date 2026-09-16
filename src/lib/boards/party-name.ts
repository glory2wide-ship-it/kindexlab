/**
 * Party-support board guards — only real party names, not politicians or issue keywords.
 */

import { normalizeName } from "@/lib/ingestion/names";
import { PARTY_SUBJECTS } from "@/lib/politics/support-series";

const PARTY_ALIASES: Record<string, string> = {
  국힘: "국민의힘",
  민주당: "더불어민주당",
  더민주: "더불어민주당",
  개혁당: "개혁신당",
};

/**
 * True when the name is a party (or known alias), not a politician / issue keyword.
 * Exact match only — blocks `기본소득` (issue) vs `기본소득당` (party), and `조국` (person).
 */
export function isLikelyPartyName(name: string): boolean {
  const cleaned = name.replace(/^\[[^\]]+\]\s*/, "").trim();
  if (!cleaned || cleaned.length > 24) return false;
  const compact = normalizeName(cleaned);
  if (!compact) return false;

  if (PARTY_ALIASES[cleaned] || PARTY_ALIASES[compact]) return true;

  for (const party of PARTY_SUBJECTS) {
    if (normalizeName(party) === compact) return true;
  }
  return false;
}
