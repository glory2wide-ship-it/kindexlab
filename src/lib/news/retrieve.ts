import { MARKET_TAPE } from "@/lib/editorial/rules";
import { nowIso } from "@/lib/ingestion/http";
import { normalizeName } from "@/lib/ingestion/names";
import { activeMarket } from "@/lib/market/config";
import { buildSearchQuery, keywordAliases, matchesAnyAlias } from "@/lib/news/aliases";
import { classifyPublisher } from "@/lib/news/publishers";
import { resolveNewsProviders } from "@/lib/news/providers";
import type { RawNewsDoc } from "@/lib/news/providers/types";
import type {
  NewsDoc,
  NewsRetrieval,
  NewsRetrievalStats,
  NewsRetrieveOptions,
  NewsSourceId,
} from "@/lib/news/types";

const DEFAULT_LIMIT = 8;
const DEFAULT_LOOKBACK_HOURS = 72;

/**
 * Retrieves recent coverage for one issue keyword across every provider the
 * active market declares. Providers are swapped by country code, so this
 * function never names a vendor.
 *
 * The output feeds the editorial prompt, so anything carrying market tape
 * (prices, ranks, percentages) is dropped rather than cleaned: a headline like
 * "음원차트 1위" would pull the column back toward the vocabulary the editorial
 * rules forbid, which is exactly what the keyword-only pipeline removed.
 */
export async function retrieveNewsForKeyword(
  keyword: string,
  options: NewsRetrieveOptions = {},
): Promise<NewsRetrieval> {
  const market = options.market ?? activeMarket();
  const limit = options.limit ?? DEFAULT_LIMIT;
  const lookbackHours = options.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;
  const trustedOnly = options.trustedOnly ?? true;
  const cutoff = Date.now() - lookbackHours * 3600_000;

  const providers = resolveNewsProviders(market);
  const errors: { source: NewsSourceId; message: string }[] = [];
  const collected: RawNewsDoc[] = [];

  // A programme, its host and its shorthand are one subject to a reader but
  // three different strings to a search index, so the query covers all of them.
  const aliases = options.aliases ?? keywordAliases(keyword);
  const query = buildSearchQuery(aliases);

  const settled = await Promise.allSettled(
    // Ask for more than the cap because the alias query returns coverage for
    // several names and the relevance filter below discards most of the spread.
    providers.map((provider) =>
      provider.search(query, { market, limit: aliases.length > 1 ? limit * 2 : limit }),
    ),
  );

  settled.forEach((result, index) => {
    const provider = providers[index];
    if (!provider) return;
    if (result.status === "fulfilled") {
      collected.push(...result.value);
      return;
    }
    const reason = result.reason;
    errors.push({
      source: provider.id,
      message: reason instanceof Error ? reason.message : "failed",
    });
  });

  const stats: NewsRetrievalStats = {
    fetched: collected.length,
    kept: 0,
    keptTrusted: 0,
    droppedStale: 0,
    droppedOffTopic: 0,
    droppedMarketTape: 0,
    droppedDuplicate: 0,
    droppedUgc: 0,
    droppedUntrusted: 0,
  };

  const seen = new Set<string>();
  const kept: NewsDoc[] = [];

  for (const doc of collected) {
    const blob = `${doc.title} ${doc.snippet ?? ""}`;

    if (doc.publishedAt && new Date(doc.publishedAt).getTime() < cutoff) {
      stats.droppedStale += 1;
      continue;
    }
    // Relevance is judged against every alias; otherwise a document the OR query
    // legitimately returned under the host's name would be discarded as
    // off-topic because it never spells out the programme.
    if (!options.skipAliasFilter && !matchesAnyAlias(aliases, doc.title) && !matchesAnyAlias(aliases, doc.snippet ?? "")) {
      stats.droppedOffTopic += 1;
      continue;
    }
    if (!options.allowMarketTape && MARKET_TAPE.test(blob)) {
      stats.droppedMarketTape += 1;
      continue;
    }
    const kind = classifyPublisher(market, doc.publisher, doc.link);
    if (kind === "ugc") {
      stats.droppedUgc += 1;
      continue;
    }
    if (trustedOnly && kind !== "trusted") {
      stats.droppedUntrusted += 1;
      continue;
    }
    const fingerprint = normalizeName(doc.title);
    if (!fingerprint || seen.has(fingerprint)) {
      stats.droppedDuplicate += 1;
      continue;
    }
    seen.add(fingerprint);
    kept.push({ ...doc, publisherKind: kind });
  }

  // Recognised outlets first, then recency within each tier.
  kept.sort((a, b) => {
    if (a.publisherKind !== b.publisherKind) return a.publisherKind === "trusted" ? -1 : 1;
    const left = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const right = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return right - left;
  });

  const docs = kept.slice(0, limit);
  stats.kept = docs.length;
  stats.keptTrusted = docs.filter((doc) => doc.publisherKind === "trusted").length;

  return {
    keyword,
    aliases,
    country: market.country,
    providers: providers.map((provider) => provider.id),
    fetchedAt: nowIso(),
    docs,
    stats,
    errors,
  };
}
