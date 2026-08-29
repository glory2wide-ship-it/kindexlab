import { retrieveNewsForKeyword } from "@/lib/news/retrieve";
import { publisherFromUrl, unwrapNewsUrls } from "@/lib/news/unwrap";

/**
 * A retrieved article that carries a resolvable URL. The premium prompt is
 * allowed to cite exactly these, which is what keeps invented links out of the
 * published body: anything the model returns is checked against this set.
 */
export interface PremiumSource {
  title: string;
  url: string;
  publisher: string;
  publishedAt?: string;
  snippet?: string;
}

export interface PremiumContext {
  keyword: string;
  sources: PremiumSource[];
  /** Providers that actually answered, for the rebuild report. */
  providers: string[];
  /** The block injected into the user message. */
  block: string;
  /** How many aggregator handles were resolved to publisher URLs, and how many were dropped. */
  unwrapped: { resolved: number; failed: number };
  /** The retrieval window that produced these sources, in hours. */
  lookbackHours: number;
}

/** Below this the column has nothing verifiable to stand on and is skipped. */
export const MIN_PREMIUM_SOURCES = 2;

const DEFAULT_LIMIT = 8;

/**
 * Retrieval windows, tried narrowest first.
 *
 * A breaking topic should be written from this week's coverage, so the sweep
 * starts at four days. Evergreen subjects — a government benefit scheme, a
 * seasonal programme — are covered in bursts and can have nothing at all in
 * that window while being well documented over a month. Widening only when the
 * narrow window comes up short keeps recency where recency exists.
 */
const LOOKBACK_LADDER_HOURS = [96, 336, 720] as const;

function usableUrl(link: string | undefined): link is string {
  if (!link) return false;
  try {
    const url = new URL(link);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const time = new Date(raw).getTime();
  if (!Number.isFinite(time)) return undefined;
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Retrieves live coverage for one keyword and renders it as prompt context.
 *
 * Aggregator handles are resolved to the publisher's own URL first, because a
 * citation pointing at a redirector carries none of the authorship signal
 * E-E-A-T is judged on. Anything that will not resolve is dropped rather than
 * passed through: a source the model cannot cite honestly is a source it might
 * paraphrase into a fake URL.
 */
export async function collectPremiumContext(
  keyword: string,
  options: { limit?: number; lookbackHours?: number } = {},
): Promise<PremiumContext> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const ladder = options.lookbackHours ? [options.lookbackHours] : [...LOOKBACK_LADDER_HOURS];

  let providers: string[] = [];
  let sources: PremiumSource[] = [];
  let unwrapped = { resolved: 0, failed: 0 };
  let lookbackHours = ladder[0] ?? 96;

  for (const hours of ladder) {
    const retrieval = await retrieveNewsForKeyword(keyword, { limit, lookbackHours: hours });
    providers = retrieval.providers;
    lookbackHours = hours;

    const links = retrieval.docs.map((doc) => doc.link).filter(usableUrl);
    const { resolved, stats } = await unwrapNewsUrls(links);
    unwrapped = { resolved: stats.resolved, failed: stats.failed };

    const seen = new Set<string>();
    sources = [];
    for (const doc of retrieval.docs) {
      if (!usableUrl(doc.link)) continue;
      const target = resolved.get(doc.link);
      if (!target) continue;
      if (seen.has(target)) continue;
      seen.add(target);
      sources.push({
        title: doc.title,
        url: target,
        // The feed's outlet name reads better than a bare domain; the resolved
        // host is the fallback when the aggregator omitted it.
        publisher: doc.publisher || publisherFromUrl(target),
        publishedAt: formatDate(doc.publishedAt),
        snippet: doc.snippet?.slice(0, 220),
      });
    }

    if (sources.length >= MIN_PREMIUM_SOURCES) break;
  }

  return {
    keyword,
    sources,
    providers,
    block: renderContextBlock(keyword, sources),
    unwrapped,
    lookbackHours,
  };
}

export function renderContextBlock(keyword: string, sources: PremiumSource[]): string {
  if (!sources.length) {
    return `[최신 뉴스 데이터] 수집된 기사가 없습니다. 외부 링크를 만들어 내지 마세요.`;
  }
  const lines = sources.map((source, index) => {
    const meta = [source.publisher, source.publishedAt].filter(Boolean).join(" · ");
    return [
      `${index + 1}. ${source.title}`,
      `   출처: ${meta}`,
      `   URL: ${source.url}`,
      source.snippet ? `   요약: ${source.snippet}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    `[포커스 키워드] ${keyword}`,
    "",
    "[최신 뉴스 데이터(실제 URL 포함)]",
    ...lines,
    "",
    "위 URL 목록에 없는 주소는 어떤 경우에도 본문에 쓰지 마세요.",
  ].join("\n");
}

/** True when the href exactly matches one of the retrieved articles. */
export function isRetrievedUrl(href: string, sources: PremiumSource[]): boolean {
  return sources.some((source) => source.url === href);
}
