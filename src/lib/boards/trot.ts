/**
 * Trot / 성인가요 artist guards — keep K-POP and 트로트·가요 heatmaps disjoint.
 */

import { getBoard } from "@/lib/boards/registry";
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";

const TROT_BOARD_SLUG = "trot-kayo-fandom-power";
const KPOP_BOARD_SLUG = "kpop-fandom-power";

const TROT_KEYWORDS =
  /트로트|미스터트롯|미스트롯|불후의\s*명곡|가요무대|성인가요|7080|전국노래자랑|트롯|뽕짝/;

let trotSeedsCache: string[] | null = null;
let kpopSeedsCache: string[] | null = null;

function trotSeedNames(): string[] {
  if (!trotSeedsCache) {
    trotSeedsCache = [...(getBoard(TROT_BOARD_SLUG)?.seeds ?? [])];
  }
  return trotSeedsCache;
}

function kpopSeedNames(): string[] {
  if (!kpopSeedsCache) {
    kpopSeedsCache = [...(getBoard(KPOP_BOARD_SLUG)?.seeds ?? [])];
  }
  return kpopSeedsCache;
}

function stripDecorators(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hitsSeedList(name: string, seeds: readonly string[]): boolean {
  const cleaned = stripDecorators(name);
  if (!cleaned) return false;
  const compact = normalizeName(cleaned);
  for (const seed of seeds) {
    const subject = stripDecorators(seed);
    if (!subject) continue;
    if (namesOverlap(subject, cleaned)) return true;
    const seedKey = normalizeName(subject);
    if (seedKey && (compact === seedKey || compact.includes(seedKey) || seedKey.includes(compact))) {
      return true;
    }
  }
  return false;
}

/** True when the name belongs on the 트로트·가요 board. */
export function isLikelyTrotArtist(name: string): boolean {
  const cleaned = stripDecorators(name);
  if (!cleaned) return false;
  if (TROT_KEYWORDS.test(cleaned)) return true;
  if (hitsSeedList(cleaned, trotSeedNames())) return true;
  return false;
}

/** True when the name is a known K-POP idol/group seed (exclude from trot live). */
export function isLikelyKpopIdol(name: string): boolean {
  const cleaned = stripDecorators(name);
  if (!cleaned) return false;
  if (/아이돌|걸그룹|보이그룹|K-?POP/i.test(cleaned)) return true;
  if (hitsSeedList(cleaned, kpopSeedNames()) && !isLikelyTrotArtist(cleaned)) return true;
  return false;
}

/** Live-overlay gate for K-POP vs 트로트·가요 menus. */
export function passesKpopTrotBoardFilter(boardSlug: string, name: string): boolean {
  if (boardSlug === KPOP_BOARD_SLUG) {
    return !isLikelyTrotArtist(name);
  }
  if (boardSlug === TROT_BOARD_SLUG) {
    if (isLikelyKpopIdol(name) && !isLikelyTrotArtist(name)) return false;
    return isLikelyTrotArtist(name);
  }
  return true;
}
