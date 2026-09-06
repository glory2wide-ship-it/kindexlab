export type CountryCode = "KR" | "US" | "GB" | "DE" | "JP";

export type NewsProviderId = "google-news" | "naver-news" | "serper";
export type AffiliateProviderId = "coupang" | "toss" | "amazon";

export interface MarketConfig {
  country: CountryCode;
  /** BCP 47 tag used for date and currency formatting. */
  locale: string;
  language: string;
  currency: string;
  /** Google News RSS locale parameters. */
  googleNews: { hl: string; gl: string; ceid: string };
  /** Amazon storefront host; unused by markets without an Amazon program. */
  amazonHost: string;
  /** Priority order. Unconfigured providers are skipped at resolve time. */
  newsProviders: NewsProviderId[];
  /** First entry is the primary shelf; the rest render as secondary links. */
  affiliateProviders: AffiliateProviderId[];
}

const MARKETS: Record<CountryCode, MarketConfig> = {
  KR: {
    country: "KR",
    locale: "ko-KR",
    language: "ko",
    currency: "KRW",
    googleNews: { hl: "ko", gl: "KR", ceid: "KR:ko" },
    amazonHost: "www.amazon.com",
    newsProviders: ["google-news", "naver-news", "serper"],
    affiliateProviders: ["coupang", "toss"],
  },
  US: {
    country: "US",
    locale: "en-US",
    language: "en",
    currency: "USD",
    googleNews: { hl: "en-US", gl: "US", ceid: "US:en" },
    amazonHost: "www.amazon.com",
    newsProviders: ["google-news", "serper"],
    affiliateProviders: ["amazon"],
  },
  GB: {
    country: "GB",
    locale: "en-GB",
    language: "en",
    currency: "GBP",
    googleNews: { hl: "en-GB", gl: "GB", ceid: "GB:en" },
    amazonHost: "www.amazon.co.uk",
    newsProviders: ["google-news", "serper"],
    affiliateProviders: ["amazon"],
  },
  DE: {
    country: "DE",
    locale: "de-DE",
    language: "de",
    currency: "EUR",
    googleNews: { hl: "de", gl: "DE", ceid: "DE:de" },
    amazonHost: "www.amazon.de",
    newsProviders: ["google-news", "serper"],
    affiliateProviders: ["amazon"],
  },
  JP: {
    country: "JP",
    locale: "ja-JP",
    language: "ja",
    currency: "JPY",
    googleNews: { hl: "ja", gl: "JP", ceid: "JP:ja" },
    amazonHost: "www.amazon.co.jp",
    newsProviders: ["google-news", "serper"],
    affiliateProviders: ["amazon"],
  },
};

export const DEFAULT_COUNTRY: CountryCode = "KR";

export function isCountryCode(value: string): value is CountryCode {
  return value in MARKETS;
}

export function getMarket(country?: CountryCode): MarketConfig {
  return MARKETS[country ?? DEFAULT_COUNTRY];
}

/**
 * Reads the active market from the environment. The variable is NEXT_PUBLIC_ so
 * client components resolve the same market the server rendered.
 */
export function activeMarket(): MarketConfig {
  const raw = (process.env.NEXT_PUBLIC_MARKET_COUNTRY ?? "").trim().toUpperCase();
  return getMarket(isCountryCode(raw) ? raw : DEFAULT_COUNTRY);
}

export function listCountryCodes(): CountryCode[] {
  return Object.keys(MARKETS) as CountryCode[];
}

export function formatMoney(value: number, market: MarketConfig): string {
  try {
    return new Intl.NumberFormat(market.locale, {
      style: "currency",
      currency: market.currency,
      maximumFractionDigits: market.currency === "KRW" || market.currency === "JPY" ? 0 : 2,
    }).format(value);
  } catch {
    return `${value.toLocaleString(market.locale)} ${market.currency}`;
  }
}
