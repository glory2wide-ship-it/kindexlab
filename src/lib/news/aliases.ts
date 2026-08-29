import { findTrafficChannelByName } from "@/lib/ingestion/channels";
import { namesOverlap } from "@/lib/ingestion/names";
import { matchPoliticsCatalog } from "@/lib/politics/catalog";

/** Providers reject very long queries, and extra terms dilute relevance. */
const MAX_TERMS = 4;

/**
 * Every name one subject travels under. A programme, its host and its shorthand
 * are the same story to a reader but three different strings to a search index,
 * so a query for "핑계고" alone misses the coverage filed under "유재석".
 */
export function keywordAliases(keyword: string): string[] {
  const terms = [keyword];

  const channel = findTrafficChannelByName(keyword);
  if (channel) {
    terms.push(channel.name, ...channel.aliases);
  }

  for (const entry of matchPoliticsCatalog(keyword)) {
    terms.push(entry.name, ...(entry.aliases ?? []));
  }

  const unique: string[] = [];
  for (const term of terms) {
    const trimmed = term.trim();
    if (!trimmed) continue;
    if (unique.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) continue;
    unique.push(trimmed);
  }
  return unique.slice(0, MAX_TERMS);
}

/**
 * Google News, Naver and Serper all accept OR between quoted phrases. Quoting
 * keeps multi-word aliases ("채널 십오야") from being split into loose terms.
 */
export function buildSearchQuery(terms: string[]): string {
  if (terms.length <= 1) return terms[0] ?? "";
  return terms.map((term) => `"${term}"`).join(" OR ");
}

/** True when a document mentions any alias, used in place of a single-name check. */
export function matchesAnyAlias(terms: string[], text: string): boolean {
  if (!text) return false;
  return terms.some((term) => namesOverlap(term, text));
}
