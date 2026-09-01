import { getRankings } from "@/lib/api";
import { stripRowQualifier } from "@/lib/boards/heatmap";
import { BOARDS, boardPath } from "@/lib/boards/registry";
import { rankingPath } from "@/lib/slugs";

export interface SearchSuggestion {
  label: string;
  href: string;
}

const MAX_SUGGESTIONS = 5;
const CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

function compact(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function firstChar(value: string): string {
  return Array.from(value.trim())[0] ?? "";
}

function choseongIndex(char: string): number | null {
  if (!char) return null;
  const code = char.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    return Math.floor((code - 0xac00) / 588);
  }
  const index = CHOSEONG.indexOf(char);
  return index >= 0 ? index : null;
}

function rankMatch(query: string, label: string): number {
  const needle = compact(query);
  const hay = compact(label);
  if (!needle || !hay) return 0;
  if (hay.startsWith(needle)) return 3000 - hay.length;
  if (needle.length === 1) {
    const q = firstChar(query);
    const h = firstChar(label);
    if (h === q) return 2500 - hay.length;
    const qi = choseongIndex(q);
    const hi = choseongIndex(h);
    if (qi != null && qi === hi) return 2400 - hay.length;
  }
  if (hay.includes(needle)) return 1000 - hay.indexOf(needle) - hay.length / 10;
  return 0;
}

function pushUnique(out: SearchSuggestion[], seen: Set<string>, raw: string, href: string) {
  const label = stripRowQualifier(raw).trim();
  const key = compact(label);
  if (!label || seen.has(key)) return;
  seen.add(key);
  out.push({ label, href });
}

function seedCorpus(): SearchSuggestion[] {
  const seen = new Set<string>();
  const out: SearchSuggestion[] = [];
  for (const board of BOARDS) {
    pushUnique(out, seen, board.title, boardPath(board.slug));
    if (board.shortTitle) pushUnique(out, seen, board.shortTitle, boardPath(board.slug));
    if (board.focusKeyword) {
      pushUnique(out, seen, board.focusKeyword, `/search?q=${encodeURIComponent(board.focusKeyword)}`);
    }
    for (const seed of board.seeds ?? []) {
      const label = stripRowQualifier(seed);
      pushUnique(out, seen, label, `/search?q=${encodeURIComponent(label)}`);
    }
  }
  return out;
}

const SEED_ITEMS = seedCorpus();

let marketCache: SearchSuggestion[] | null = null;
let marketLoading = false;

function refreshMarketCache() {
  if (marketLoading || marketCache) return;
  marketLoading = true;
  void getRankings()
    .then((market) => {
      const seen = new Set(SEED_ITEMS.map((item) => compact(item.label)));
      const extra: SearchSuggestion[] = [];
      for (const item of market.items ?? []) {
        if (item?.name && item?.slug) {
          pushUnique(extra, seen, item.name, rankingPath(item.slug));
        }
      }
      marketCache = extra;
    })
    .catch(() => {
      marketCache = [];
    })
    .finally(() => {
      marketLoading = false;
    });
}

function matchItems(items: SearchSuggestion[], query: string): SearchSuggestion[] {
  return items
    .map((item) => ({ item, score: rankMatch(query, item.label) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label, "ko"))
    .map((row) => row.item);
}

export async function suggestSearchTerms(query: string): Promise<SearchSuggestion[]> {
  const q = query.trim();
  if (!q) return [];

  refreshMarketCache();

  const seen = new Set<string>();
  const out: SearchSuggestion[] = [];
  for (const item of [...matchItems(SEED_ITEMS, q), ...matchItems(marketCache ?? [], q)]) {
    const key = compact(item.label);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}
